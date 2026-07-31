import { ApiError, normalizeError } from './errors';
import { apiBase, apiRequest, unwrap } from './http';

/*
 * The Services surface. A Service is one deployed solution running on a Node
 * inside a Project, under hard resource limits the tier allows. Deploying is the
 * Operator's explicit intent, so it is not routed through the Operation approval
 * gate; it still streams progress and always verifies the workload is running.
 * Lifecycle actions act on the running workload. Env values are sealed and
 * redacted in responses. Field names mirror the backend contract exactly so the
 * wire shape and the type never drift.
 */

/** How a Service runs on the Node: a container, or a systemd unit. */
/**
 * How a Service runs on the Node.
 *
 * `compose` runs a whole Docker Compose stack as the repository declares it.
 * Compose creates the network, so a service named in the file resolves by that
 * name -- which a single container on the default bridge cannot do.
 */
export type ServiceRuntime = 'container' | 'systemd' | 'compose';

/** The lifecycle state of a Service. */
export type ServiceStatus = 'deploying' | 'running' | 'stopped' | 'failed' | 'removed';

/**
 * Where a Service's workload comes from. An image source runs a prebuilt image;
 * a repository source clones the repository and builds it first. `command` is
 * the entrypoint for a systemd unit or an override for a container.
 */
export interface ServiceSource {
  /**
   * `adopted` marks a workload that was already running when SlideOps found it,
   * so there is no image or repository to rebuild it from; the image, where the
   * runtime reports one, is kept for display only.
   */
  type: 'image' | 'repository' | 'adopted';
  image?: string;
  repository_url?: string;
  /** The branch to clone and pull for a repository source. Defaults to main. */
  branch?: string;
  build?: string;
  command?: string;
}

/** One published port: a Node port mapped to a port inside the workload. */
export interface ServicePort {
  /**
   * The port on the server. Send {@link AUTO_HOST_PORT} to have SlideOps choose a
   * free one, which is the normal case: it avoids both the ports it has already
   * given out on that server and the ports the server reports as listening, so a
   * second application cannot land on the first one's port.
   *
   * A number you set is honoured exactly, even if something else holds it. You may
   * know something SlideOps does not, and the deploy reports the conflict from the
   * server itself rather than moving your application somewhere you did not ask for.
   */
  host: number;
  container: number;
}

/**
 * The host port that means "choose one for me". Zero is never a real published
 * port, so it reads unambiguously as an instruction rather than as an address.
 */
export const AUTO_HOST_PORT = 0;

/**
 * A Service. `env` is redacted in responses, so it is never returned inline.
 * `container_ref` is the container name or the unit name on the Node.
 */
export interface Service {
  id: string;
  name: string;
  project_id: string;
  node_id: string;
  runtime: ServiceRuntime;
  source: ServiceSource;
  cpu_limit: number;
  memory_mb: number;
  pids_limit?: number;
  /**
   * The Service's environment as stored. A sealed value reads as the redaction
   * marker rather than the value, since a secret is never returned.
   */
  env?: Record<string, string>;
  ports?: ServicePort[];
  status: ServiceStatus;
  container_ref?: string;
  /**
   * The full git SHA the Service last deployed from a repository source. Empty
   * before the first repository deploy, and unset for an image source.
   */
  deployed_commit?: string;
  /**
   * Whether this Service was already running on the server when SlideOps found
   * it, rather than one SlideOps deployed. SlideOps did not build an adopted
   * workload, so it is never redeployed, and removing it releases it from
   * management instead of tearing down something SlideOps never created.
   */
  adopted?: boolean;
  /**
   * Why the most recent deploy failed, empty once one succeeds. Kept so an
   * Operator who was not watching the live stream can still find out.
   */
  last_error?: string;
  /**
   * When the command or environment was last edited. Present and later than the
   * running workload means a redeploy is needed to apply it.
   */
  config_changed_at?: string;
  /**
   * The hostname this Service answers on, empty until one is assigned.
   *
   * Every Service gets one as part of deploying, so it is reachable by name rather
   * than at an address with a port number in it. It survives a redeploy that moves
   * the port, and it is the name the certificate is issued for.
   */
  domain?: string;
  /**
   * The addresses this Service answers on from outside the server, best first:
   * `https://<domain>` when it has one, then `http://<node-address>:<host-port>`
   * per published port. Computed on every read rather than stored, so it stays
   * correct if the server's address changes.
   *
   * The first entry is the base URL to give another program: a frontend, a mobile
   * app, or a second Service.
   */
  public_urls?: string[];
  created_at: string;
  updated_at?: string;
}

/**
 * The resource ceilings a running Service runs under: the vCPU limit, the memory
 * limit in whole MB, and the maximum number of processes. Every value must be
 * greater than zero. Field names mirror the backend contract exactly.
 */
export interface ServiceResources {
  cpu_limit: number;
  memory_mb: number;
  pids_limit: number;
}

/**
 * The result of checking whether a repository backed Service is behind its
 * branch. `update_available` is true when the remote branch head differs from
 * the deployed commit; `reason` explains a false or edge result (for example an
 * image source, or no deployed commit recorded yet). Field names mirror the
 * backend contract exactly.
 */
export interface ServiceUpdate {
  source: string;
  branch: string;
  deployed_commit: string;
  latest_commit: string;
  update_available: boolean;
  reason: string;
}

/** Live resource usage for one Service, read over SSH. */
export interface ServiceMetrics {
  cpu_percent: number;
  memory_used_mb: number;
  memory_limit_mb: number;
}

/** The fields required to deploy a Service. */
export interface DeployServiceInput {
  project_id: string;
  node_id: string;
  name: string;
  runtime: ServiceRuntime;
  source: ServiceSource;
  /** The vCPU ceiling, for example 0.5. */
  cpu_limit: number;
  /** The memory ceiling in whole MB. */
  memory_mb: number;
  /** The maximum number of processes, optional. */
  pids_limit?: number;
  /**
   * Environment variables, one entry each.
   *
   * An array rather than a map, because each variable carries its own `secret`
   * flag and a map cannot express that. A secret entry is sealed in the secret
   * store, replaced with a redaction marker everywhere it is stored or returned,
   * and revealed only at deploy time. A non-secret entry is stored as given and
   * stays readable.
   */
  env?: ServiceEnvVar[];
  ports?: ServicePort[];
}

/**
 * One environment variable on a deploy.
 *
 * `secret: true` seals the value: it never appears in the database, in a
 * response, or in a log, and it is revealed only to the deploy itself. That also
 * means **you cannot read it back afterwards**, so mark what is genuinely
 * sensitive and leave the rest plain.
 */
export interface ServiceEnvVar {
  /**
   * Leave this variable's stored value untouched. It is how an editor says "I did
   * not change this sealed value", which an empty string cannot say, because that
   * already means "make this empty".
   */
  keep?: boolean;
  key: string;
  value: string;
  secret: boolean;
}

/** List the Operator's Services, with status and enough to show live usage. */
export function listServices(signal?: AbortSignal): Promise<Service[]> {
  return apiRequest<unknown>('/services', { signal }).then((r) => unwrap<Service[]>(r, 'services'));
}

/** Read one Service by its id. */
export function getService(id: string, signal?: AbortSignal): Promise<Service> {
  return apiRequest<unknown>(`/services/${id}`, { signal }).then((r) =>
    unwrap<Service>(r, 'service'),
  );
}

/**
 * Deploy a Service. Returns the Service at status deploying, after the quota
 * check. Over quota the backend returns 403 with code quota_exceeded and a clear
 * message naming the limit hit.
 */
export function deployService(input: DeployServiceInput): Promise<Service> {
  return apiRequest<unknown>('/services', { method: 'POST', body: input }).then((r) =>
    unwrap<Service>(r, 'service'),
  );
}

/** Start a stopped Service's workload. */
export function startService(id: string): Promise<void> {
  return apiRequest<void>(`/services/${id}/start`, { method: 'POST' });
}

/** Stop a running Service's workload without removing it. */
export function stopService(id: string): Promise<void> {
  return apiRequest<void>(`/services/${id}/stop`, { method: 'POST' });
}

/** Restart a Service's workload. */
export function restartService(id: string): Promise<void> {
  return apiRequest<void>(`/services/${id}/restart`, { method: 'POST' });
}

/** Stop and remove a Service's workload, freeing its allocation. */
export function removeService(id: string): Promise<void> {
  return apiRequest<void>(`/services/${id}`, { method: 'DELETE' });
}

/**
 * Read recent logs for a Service. The backend returns either a JSON envelope
 * carrying the log text or a bare text body, so this reads the raw text and only
 * unwraps a JSON envelope when the body parses as one. That keeps a plain log
 * stream intact, which the shared JSON request helper would otherwise discard.
 */
export async function getServiceLogs(
  id: string,
  tail = 200,
  signal?: AbortSignal,
): Promise<string> {
  const base = apiBase();
  const origin =
    typeof window !== 'undefined' && window.location ? window.location.origin : 'http://localhost';
  const url = new URL(`${base}/services/${id}/logs`, origin);
  url.searchParams.set('tail', String(tail));

  let response: Response;
  try {
    response = await fetch(url, { credentials: 'include', signal });
  } catch (cause) {
    throw new ApiError(0, 'network_error', 'The network request failed.', cause);
  }

  const text = await response.text();
  if (!response.ok) {
    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : undefined;
    } catch {
      parsed = undefined;
    }
    throw normalizeError(response.status, parsed);
  }

  if (!text) {
    return '';
  }
  try {
    const parsed = JSON.parse(text);
    const logs = unwrap<unknown>(parsed, 'logs');
    if (typeof logs === 'string') {
      return logs;
    }
    if (Array.isArray(logs)) {
      return logs.map((line) => String(line)).join('\n');
    }
    return typeof parsed === 'string' ? parsed : text;
  } catch {
    // A bare text body is the raw log stream; return it as-is.
    return text;
  }
}

/** Read live resource usage for a Service. */
export function getServiceMetrics(id: string, signal?: AbortSignal): Promise<ServiceMetrics> {
  return apiRequest<unknown>(`/services/${id}/metrics`, { signal }).then((r) =>
    unwrap<ServiceMetrics>(r, 'metrics'),
  );
}

/**
 * Check whether a Service's repository has a newer commit than the one it is
 * running. This only observes; it never changes the Service. An image source
 * comes back with update_available false and a reason naming why.
 */
export function checkServiceUpdate(id: string, signal?: AbortSignal): Promise<ServiceUpdate> {
  return apiRequest<unknown>(`/services/${id}/update-check`, { signal }).then((r) =>
    unwrap<ServiceUpdate>(r, 'update'),
  );
}

/**
 * Redeploy a Service to the latest commit on its branch: pull, rebuild, and
 * rerun. Returns the Service at status deploying. The backend maps a missing
 * Service to 404 and an already removed one to 409, both surfaced as ApiError.
 */
export function redeployService(id: string): Promise<Service> {
  return apiRequest<unknown>(`/services/${id}/redeploy`, { method: 'POST' }).then((r) =>
    unwrap<Service>(r, 'service'),
  );
}

/**
 * Resize a running Service's resource allocation in place: CPU, memory, and the
 * process limit. The backend applies the new limits to the running workload with
 * no rebuild or downtime (docker update or systemctl set-property) and returns
 * the updated Service. A limit that is not greater than zero comes back as 400
 * with code invalid_resources; a missing or unowned Service as 404. Both surface
 * as a typed ApiError.
 */
export function updateServiceResources(id: string, resources: ServiceResources): Promise<Service> {
  return apiRequest<unknown>(`/services/${id}/resources`, {
    method: 'PATCH',
    body: resources,
  }).then((r) => unwrap<Service>(r, 'service'));
}

/**
 * Edit a deployed Service's command and environment variables.
 *
 * `env` **replaces** rather than merges, so send the complete set you want:
 * leaving one out is how it is removed, and a previously sealed secret you do not
 * resend is dropped for the same reason.
 *
 * The change is saved but **not yet live**: a container bakes its command and
 * environment in when it is created, so `redeployService` is what applies it. The
 * returned Service carries `config_changed_at` so a screen can say so.
 */
export function updateServiceConfiguration(
  id: string,
  configuration: { command: string; env: ServiceEnvVar[] },
): Promise<Service> {
  return apiRequest<unknown>(`/services/${encodeURIComponent(id)}/configuration`, {
    method: 'PATCH',
    body: configuration,
  }).then((r) => unwrap<Service>(r, 'service'));
}

/**
 * Stop a deploy that is still running and leave the Service in place.
 *
 * It stops the work; it does not undo it. A build that had begun is abandoned, and
 * whatever the previous deploy left running is untouched, which is exactly why
 * this is separate from removing the Service.
 *
 * It also clears a Service stranded at `deploying` by a restart.
 */
export function cancelServiceDeploy(id: string): Promise<Service> {
  return apiRequest<unknown>(`/services/${encodeURIComponent(id)}/cancel-deploy`, {
    method: 'POST',
  }).then((r) => unwrap<Service>(r, 'service'));
}

/** What one step of a compose stack plan will do. */
export interface StackStep {
  kind: 'install' | 'provision' | 'deploy';
  compose_service: string;
  capability_key?: string;
  title: string;
  detail: string;
  /** The inputs the step runs with. A secret's value is never included. */
  parameters?: Record<string, string>;
  /** Inputs whose values are sealed and deliberately withheld from the plan. */
  secret_parameters?: string[];
}

/**
 * One environment variable the application will be handed, and where it comes
 * from. The shape is shown with the secret withheld, because a plan carrying a
 * password is not safe to display and a plan you cannot check is not a plan.
 */
export interface StackEnvAssignment {
  key: string;
  from: string;
  shape: string;
}

/** What SlideOps would do with a repository's compose file. Nothing has run yet. */
export interface StackPlan {
  compose_file: string;
  steps: StackStep[];
  environment: StackEnvAssignment[];
  /** The compose services that are your own code, built from the repository. */
  application: string[];
  /** Services SlideOps has no Capability for. Named, never quietly dropped. */
  unrecognised: string[];
  warnings?: string[];
}

/**
 * Ask what SlideOps would do with a repository's Docker Compose file.
 *
 * It plans and stops: nothing is installed, nothing is created, and nothing
 * reaches your server. Safe to call as often as you like.
 */
export function planComposeStack(input: {
  node_id: string;
  repository_url: string;
  branch?: string;
  name?: string;
}): Promise<StackPlan> {
  return apiRequest<unknown>('/services/compose-plan', { method: 'POST', body: input }).then((r) =>
    unwrap<StackPlan>(r, 'plan'),
  );
}

/**
 * Approve a compose plan and run it end to end: install each backing engine as a
 * managed Capability, create the database and account your application needs with
 * a generated password, then build and deploy your application with those
 * credentials already in its environment.
 *
 * Every Capability runs as a real Operation: planned, approved, executed,
 * verified, recorded in History. Calling this is the approval that authorises them.
 *
 * It returns immediately with the Service at `deploying`. Cancelling that deploy
 * cancels the provisioning too. If a step fails, what already succeeded is left in
 * place and named in the failure; every step is idempotent, so running the plan
 * again completes what is missing.
 */
export function deployComposeStack(input: {
  node_id: string;
  project_id: string;
  repository_url: string;
  branch?: string;
  name?: string;
  cpu_limit: number;
  memory_mb: number;
  ports?: ServicePort[];
  env?: ServiceEnvVar[];
  build?: string;
  command?: string;
}): Promise<Service> {
  return apiRequest<unknown>('/services/compose-plan/deploy', {
    method: 'POST',
    body: input,
  }).then((r) => unwrap<Service>(r, 'service'));
}

/**
 * Give a Service its own web address: assign a hostname if it has none, route it
 * through the reverse proxy, and ask for a certificate.
 *
 * You will not usually need this. Every Service deployed since hostnames existed
 * gets one automatically. It is for the two cases left over: a Service deployed
 * before that, which has a port and no name, and one whose routing or certificate
 * did not take the first time.
 *
 * It answers as soon as the hostname is settled and the routing streams after,
 * like a deploy. It never changes an address a Service already has, so calling it
 * again retries the route rather than handing out a different name. Nothing is
 * rebuilt and the workload is not restarted.
 */
export function exposeService(id: string): Promise<Service> {
  return apiRequest<unknown>(`/services/${encodeURIComponent(id)}/expose`, {
    method: 'POST',
  }).then((r) => unwrap<Service>(r, 'service'));
}
