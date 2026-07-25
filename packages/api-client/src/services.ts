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
export type ServiceRuntime = 'container' | 'systemd';

/** The lifecycle state of a Service. */
export type ServiceStatus = 'deploying' | 'running' | 'stopped' | 'failed' | 'removed';

/**
 * Where a Service's workload comes from. An image source runs a prebuilt image;
 * a repository source clones the repository and builds it first. `command` is
 * the entrypoint for a systemd unit or an override for a container.
 */
export interface ServiceSource {
  type: 'image' | 'repository';
  image?: string;
  repository_url?: string;
  /** The branch to clone and pull for a repository source. Defaults to main. */
  branch?: string;
  build?: string;
  command?: string;
}

/** One published port: a Node port mapped to a port inside the workload. */
export interface ServicePort {
  host: number;
  container: number;
}

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
  ports?: ServicePort[];
  status: ServiceStatus;
  container_ref?: string;
  /**
   * The full git SHA the Service last deployed from a repository source. Empty
   * before the first repository deploy, and unset for an image source.
   */
  deployed_commit?: string;
  created_at: string;
  updated_at?: string;
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
  /** Environment variables. Secret values are sealed and redacted afterward. */
  env?: Record<string, string>;
  ports?: ServicePort[];
}

/** List the Operator's Services, with status and enough to show live usage. */
export function listServices(signal?: AbortSignal): Promise<Service[]> {
  return apiRequest<unknown>('/services', { signal }).then((r) => unwrap<Service[]>(r, 'services'));
}

/** Read one Service by its id. */
export function getService(id: string, signal?: AbortSignal): Promise<Service> {
  return apiRequest<unknown>(`/services/${id}`, { signal }).then((r) => unwrap<Service>(r, 'service'));
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
export async function getServiceLogs(id: string, tail = 200, signal?: AbortSignal): Promise<string> {
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
