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
  const lines = (text ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  for (const raw of lines) {
    let line = raw;
    let secret = false;
    if (line.toLowerCase().startsWith(SECRET_PREFIX)) {
      secret = true;
      line = line.slice(SECRET_PREFIX.length).trim();
    }

    const eq = line.indexOf('=');
    if (eq <= 0) {
      return { env: [], error: `Write each variable as KEY=value. Got "${raw}".` };
    }
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      return { env: [], error: `"${key}" is not a valid variable name.` };
    }
    if (seen.has(key)) {
      return { env: [], error: `"${key}" is set more than once.` };
    }
    seen.add(key);
    env.push({ key, value, secret });
  }
  return { env };
}

/** Turn validated form values into the deploy input the backend expects. */
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
  const pids = typeof values.pids_limit === 'number' ? values.pids_limit : undefined;

  return {
    project_id: values.project_id,
    node_id: values.node_id,
    name: values.name,
    runtime: values.runtime,
    source,
    cpu_limit: values.cpu_limit,
    memory_mb: values.memory_mb,
    pids_limit: pids,
    env: env.length > 0 ? env : undefined,
    ports: ports.length > 0 ? ports : undefined,
  };
}
