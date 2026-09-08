import {
  AUTO_HOST_PORT,
  type DeployServiceInput,
  type ServiceEnvVar,
  type ServicePort,
} from '@slideops/api-client';
import { z } from 'zod';

/*
 * The deploy form schema. A Service needs a Project and a Node, a source (a
 * prebuilt image or a repository to build), a runtime, and the CPU, memory, and
 * pids limits the Operator chooses to run it under on their own server. Those
 * limits are the Operator's choice, not a tier cap, so the schema only holds them
 * to a sane minimum. Ports and env are entered as text and parsed into the wire
 * shapes the backend expects.
 */

const MIN_MEMORY_MB = 16;

/** Build the deploy schema. CPU and memory are the Operator's own choice on their
 *  server, so only a sensible minimum is enforced, never a tier ceiling. */
export function buildServiceSchema() {
  return z
    .object({
      project_id: z.string().trim().min(1, 'Choose a Project for this Service.'),
      node_id: z.string().trim().min(1, 'Choose a Node to run this Service on.'),
      name: z
        .string()
        .trim()
        .min(1, 'Give this Service a name.')
        .max(63, 'Keep the name under 64 characters.')
        .regex(/^[a-z0-9][a-z0-9-]*$/, 'Use lowercase letters, numbers, and hyphens.'),
      runtime: z.enum(['container', 'systemd', 'compose']),
      source_type: z.enum(['image', 'repository']),
      image: z.string().trim().optional(),
      repository_url: z.string().trim().optional(),
      branch: z.string().trim().max(255, 'Keep the branch name short.').optional(),
      build: z.string().trim().optional(),
      command: z.string().trim().optional(),
      cpu_limit: z.coerce
        .number({ invalid_type_error: 'Enter a vCPU limit.' })
        .gt(0, 'Enter a vCPU limit above zero.'),
      memory_mb: z.coerce
        .number({ invalid_type_error: 'Enter a memory limit.' })
        .int('Enter memory as a whole number of MB.')
        .min(MIN_MEMORY_MB, `Give the Service at least ${MIN_MEMORY_MB} MB.`),
      pids_limit: z
        .union([
          z.literal(''),
          z.coerce.number().int('Enter a whole number.').positive('Enter a positive number.'),
        ])
        .optional(),
      env: z.string().optional(),
      ports: z.string().optional(),
    })
    .superRefine((values, ctx) => {
      if (values.source_type === 'image' && !values.image) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['image'],
          message: 'Enter the image to run, such as nginx:latest.',
        });
      }
      if (values.source_type === 'repository' && !values.repository_url) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['repository_url'],
          message: 'Enter the repository to clone and build.',
        });
      }
      if (values.runtime === 'systemd' && !values.command) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['command'],
          message: 'A systemd Service needs the command to run.',
        });
      }
      const portsError = parsePorts(values.ports).error;
      if (portsError) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['ports'], message: portsError });
      }
      const envError = parseEnv(values.env).error;
      if (envError) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['env'], message: envError });
      }
    });
}

/** The form value shape, inferred from the deploy schema. */
export type ServiceFormValues = z.infer<ReturnType<typeof buildServiceSchema>>;

/**
 * Parse the ports textarea.
 *
 * A line is either the port the application listens on inside its container, on
 * its own, or `host:container` to pin the public port yourself.
 *
 * The bare form is the one to reach for, and it is what the form offers by
 * default. Choosing a public port by hand is how two applications on one server
 * end up fighting over the same one, and it is a decision SlideOps can make
 * correctly without asking: it knows every port it has handed out on that server
 * and can see what the server already has listening.
 */
export function parsePorts(text?: string): { ports: ServicePort[]; error?: string } {
  const ports: ServicePort[] = [];
  const lines = (text ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  for (const line of lines) {
    const parts = line.split(':').map((part) => part.trim());
    if (parts.length > 2) {
      return {
        ports: [],
        error: `Write a port as 80, or as host:container to choose the public port yourself. Got "${line}".`,
      };
    }

    if (parts.length === 1) {
      const container = Number(parts[0]);
      if (!Number.isInteger(container) || container <= 0) {
        return { ports: [], error: `A port must be a whole number above zero. Got "${line}".` };
      }
      ports.push({ host: AUTO_HOST_PORT, container });
      continue;
    }

    const host = Number(parts[0]);
    const container = Number(parts[1]);
    if (!Number.isInteger(host) || !Number.isInteger(container) || host <= 0 || container <= 0) {
      return { ports: [], error: `Ports must be whole numbers above zero. Got "${line}".` };
    }
    ports.push({ host, container });
  }
  return { ports };
}

/** Parse the env textarea. Each line is KEY=value. */
/**
 * The marker that seals a variable. A line prefixed with it is stored in the
 * secret store rather than in the clear:
 *
 *   DATABASE_URL=postgres://…            stored as given, readable later
 *   secret:SECRET_ENCRYPTION_KEY=abc     sealed, never readable again
 *
 * Sealing is explicit rather than guessed from the name. Guessing would either
 * leak something it failed to recognise, or silently make a value the Operator
 * needs unreadable forever, and this is their infrastructure, so the choice is
 * theirs to make knowingly.
 */
export const SECRET_PREFIX = 'secret:';

/**
 * A sealed line with no value means "leave this one alone".
 *
 * A sealed value cannot be read back, so the editor has nothing to put in its
 * box and renders `secret:KEY=`. Saving that used to send an empty string, and
 * because the list replaces what is there, it deleted the value: an Operator
 * adding one variable lost every secret the Service had and found out when the
 * application would not start.
 *
 * Reading it as "keep" is safe because the alternative is not useful. Setting a
 * secret to the empty string is not something anybody means to do, and somebody
 * who genuinely wants a variable gone deletes its line, which already removes it.
 */

/**
 * Parse the environment textarea into the entries the API takes: one object per
 * variable, each carrying whether it should be sealed.
 *
 * An array, not a map. The map this used to return could not express `secret`,
 * and the API has always taken the array form, which meant every deploy that
 * set a variable was rejected with "the request body was not valid" while
 * deploys with no variables worked fine.
 */
export function parseEnv(text?: string): { env: ServiceEnvVar[]; error?: string } {
  const env: ServiceEnvVar[] = [];
  const seen = new Set<string>();
  const lines = (text ?? '').split('\n');

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i] ?? '';
    let line = raw.trim();
    if (line === '') {
      continue;
    }
    // A whole line beginning with # is a comment, which every real env file has.
    // An inline # is deliberately NOT treated as one: it is a perfectly ordinary
    // character in a password or a URL fragment, and stripping it would corrupt
    // more values than it would tidy.
    if (line.startsWith('#')) {
      continue;
    }

    let secret = false;
    if (line.toLowerCase().startsWith(SECRET_PREFIX)) {
      secret = true;
      line = line.slice(SECRET_PREFIX.length).trim();
    }
    // `export KEY=value` is how a file meant to be sourced by a shell writes it,
    // and pasting one should not be an error.
    if (line.toLowerCase().startsWith('export ')) {
      line = line.slice('export '.length).trim();
    }

    const eq = line.indexOf('=');
    if (eq <= 0) {
      return { env: [], error: `Write each variable as KEY=value. Got "${raw.trim()}".` };
    }
    const key = line.slice(0, eq).trim();
    let rest = line.slice(eq + 1);

    /*
     * A quoted value keeps its contents and loses its quotes.
     *
     * Every env file quotes a value containing spaces or JSON, because the
     * shells and loaders that read those files require it. Storing the quotes
     * as part of the value is what shipped `'{"k":"v"}'` into a container and
     * made the application fail to parse its own configuration: the quotes are
     * the file's syntax, not the customer's data.
     *
     * A quoted value may also run over several lines, which is how anybody
     * pastes a formatted JSON blob or a PEM key, so an unterminated quote keeps
     * reading until it closes.
     */
    const quote = rest.trimStart().startsWith('"') ? '"' : rest.trimStart().startsWith("'") ? "'" : '';
    let value: string;
    if (quote !== '') {
      rest = rest.trimStart().slice(1);
      const closed = closingQuoteIndex(rest, quote);
      if (closed >= 0) {
        value = rest.slice(0, closed);
      } else {
        const collected = [rest];
        let found = false;
        while (i + 1 < lines.length) {
          i += 1;
          const next = lines[i] ?? '';
          const at = closingQuoteIndex(next, quote);
          if (at >= 0) {
            collected.push(next.slice(0, at));
            found = true;
            break;
          }
          collected.push(next);
        }
        if (!found) {
          return { env: [], error: `${key} opens a quote that is never closed.` };
        }
        value = collected.join('\n');
      }
      if (quote === '"') {
        value = unescapeDoubleQuoted(value);
      }
    } else {
      // Unquoted, so surrounding whitespace is formatting rather than content.
      value = rest.trim();
    }

    const keep = secret && value === '';
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      return { env: [], error: `"${key}" is not a valid variable name.` };
    }
    if (seen.has(key)) {
      return { env: [], error: `"${key}" is set more than once.` };
    }
    seen.add(key);
    env.push({ key, value, secret, keep });
  }
  return { env };
}

/**
 * Where a quoted value ends, skipping a quote the value escaped for itself.
 *
 * Returns -1 when the quote does not close on this line, which is what tells the
 * parser to keep reading into the next one.
 */
function closingQuoteIndex(text: string, quote: string): number {
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '\\' && quote === '"') {
      i += 1;
      continue;
    }
    if (text[i] === quote) {
      return i;
    }
  }
  return -1;
}

/**
 * Apply the escapes a double quoted value is allowed to carry.
 *
 * Only inside double quotes, matching how env files are read everywhere else: a
 * single quoted value is literal, so a backslash in a Windows path or a regular
 * expression stays exactly as it was typed.
 */
function unescapeDoubleQuoted(value: string): string {
  return value.replace(/\\(.)/g, (_match, char: string) => {
    switch (char) {
      case 'n':
        return '\n';
      case 'r':
        return '\r';
      case 't':
        return '\t';
      default:
        return char;
    }
  });
}

/**
 * Turn form values into the deploy input the backend expects.
 *
 * Despite the type annotation promising `ServiceFormValues`' numeric fields
 * are already real numbers, that is only true once react-hook-form's Zod
 * resolver has actually run - true for the values `handleSubmit` hands its
 * callback, false for `getValues()`, which reads the raw, unvalidated form
 * state straight from the HTML inputs (strings) and is what the Preflight
 * button calls this with. `Number(...)` here makes the output correct either
 * way, rather than trusting the caller to have gone through validation
 * first - the backend's `memory_mb`/`cpu_limit` are a strict int/float, and
 * a string there fails the request outright with a decode error, not a
 * helpful validation message.
 */
export function toDeployInput(values: ServiceFormValues): DeployServiceInput {
  const source =
    values.source_type === 'image'
      ? { type: 'image' as const, image: values.image, command: values.command || undefined }
      : {
          type: 'repository' as const,
          repository_url: values.repository_url,
          // The backend defaults an empty branch to main, so send it only when set.
          branch: values.branch || undefined,
          build: values.build || undefined,
          command: values.command || undefined,
        };

  const { ports } = parsePorts(values.ports);
  const { env } = parseEnv(values.env);
  const pids =
    typeof values.pids_limit === 'number'
      ? values.pids_limit
      : values.pids_limit
        ? Number(values.pids_limit)
        : undefined;

  return {
    project_id: values.project_id,
    node_id: values.node_id,
    name: values.name,
    runtime: values.runtime,
    source,
    cpu_limit: Number(values.cpu_limit),
    memory_mb: Number(values.memory_mb),
    pids_limit: pids,
    env: env.length > 0 ? env : undefined,
    ports: ports.length > 0 ? ports : undefined,
  };
}
