import type { DeployServiceInput, ServicePort } from '@slideops/api-client';
import { z } from 'zod';

/*
 * The deploy form schema. A Service needs a Project and a Node, a source (a
 * prebuilt image or a repository to build), a runtime, and hard CPU, memory, and
 * pids limits. The numeric limits are validated here and then constrained to the
 * Operator's remaining quota by the caller, which passes the headroom in so a
 * deploy that would exceed the tier is caught before it is sent. Ports and env
 * are entered as text and parsed into the wire shapes the backend expects.
 */

/** The remaining tier headroom the form validates the numeric limits against. */
export interface QuotaHeadroom {
  /** vCPU still available to allocate, at least zero. */
  vcpu: number;
  /** Memory in MB still available to allocate, at least zero. */
  memory_mb: number;
}

const MIN_CPU = 0.1;
const MIN_MEMORY_MB = 16;

/** Build the deploy schema, constraining CPU and memory to the remaining quota. */
export function buildServiceSchema(headroom: QuotaHeadroom) {
  const cpuCeiling = Math.max(MIN_CPU, headroom.vcpu);
  const memoryCeiling = Math.max(MIN_MEMORY_MB, headroom.memory_mb);

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
      runtime: z.enum(['container', 'systemd']),
      source_type: z.enum(['image', 'repository']),
      image: z.string().trim().optional(),
      repository_url: z.string().trim().optional(),
      branch: z.string().trim().max(255, 'Keep the branch name short.').optional(),
      build: z.string().trim().optional(),
      command: z.string().trim().optional(),
      cpu_limit: z.coerce
        .number({ invalid_type_error: 'Enter a vCPU limit.' })
        .gt(0, 'Enter a vCPU limit above zero.')
        .max(cpuCeiling, `Your tier leaves ${cpuCeiling} vCPU. Ask an admin to raise your tier for more.`),
      memory_mb: z.coerce
        .number({ invalid_type_error: 'Enter a memory limit.' })
        .int('Enter memory as a whole number of MB.')
        .min(MIN_MEMORY_MB, `Give the Service at least ${MIN_MEMORY_MB} MB.`)
        .max(
          memoryCeiling,
          `Your tier leaves ${memoryCeiling} MB. Ask an admin to raise your tier for more.`,
        ),
      pids_limit: z
        .union([z.literal(''), z.coerce.number().int('Enter a whole number.').positive('Enter a positive number.')])
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

/** The form value shape, inferred from a schema built with zero headroom. */
export type ServiceFormValues = z.infer<ReturnType<typeof buildServiceSchema>>;

/** Parse the ports textarea. Each line is host:container, both whole numbers. */
export function parsePorts(text?: string): { ports: ServicePort[]; error?: string } {
  const ports: ServicePort[] = [];
  const lines = (text ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  for (const line of lines) {
    const parts = line.split(':').map((part) => part.trim());
    if (parts.length !== 2) {
      return { ports: [], error: `Write each port as host:container, for example 8080:80. Got "${line}".` };
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
export function parseEnv(text?: string): { env: Record<string, string>; error?: string } {
  const env: Record<string, string> = {};
  const lines = (text ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  for (const line of lines) {
    const eq = line.indexOf('=');
    if (eq <= 0) {
      return { env: {}, error: `Write each variable as KEY=value. Got "${line}".` };
    }
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      return { env: {}, error: `"${key}" is not a valid variable name.` };
    }
    env[key] = value;
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
    env: Object.keys(env).length > 0 ? env : undefined,
    ports: ports.length > 0 ? ports : undefined,
  };
}
