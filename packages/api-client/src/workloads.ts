import { apiRequest, unwrap } from './http';
import type { Service, ServicePort, ServiceRuntime, ServiceStatus } from './services';

/*
 * What is already running on a server, and bringing it under management.
 *
 * A server rarely arrives empty. An Operator who ran apps on it before they
 * found SlideOps, or who set it up from a different account, can adopt those
 * workloads instead of deploying them again. Listing them reads the server and
 * changes nothing; adopting one records what is already there and starts,
 * stops, and rebuilds nothing, so the workload keeps running exactly as it was.
 *
 * Workloads that belong to a Capability rather than to an app, a database engine
 * or a web server for example, are not listed here: those show up as
 * Capabilities already in place on the server.
 */

/**
 * One workload already running on a server. `ref` is the container name or unit
 * name it is reached by, and is what an adopted Service records so every
 * lifecycle action lands on the real workload. `adopted` marks one that is
 * already managed, in which case `service_id` names the Service.
 */
export interface Workload {
  ref: string;
  name: string;
  runtime: ServiceRuntime;
  /** The container image, when the runtime reports one. */
  image?: string;
  /** The unit description, for a systemd workload. */
  description?: string;
  ports: ServicePort[];
  status: ServiceStatus;
  /** The CPU ceiling it runs under. Zero means the Operator set no limit. */
  cpu_limit: number;
  /** The memory ceiling in whole MB. Zero means the Operator set no limit. */
  memory_mb: number;
  adopted: boolean;
  service_id?: string;
}

/** What to adopt, and the Project to file the resulting Service under. */
export interface AdoptWorkloadInput {
  project_id: string;
  ref: string;
  runtime: ServiceRuntime;
  /** The name to manage it under. Defaults to the workload's own name. */
  name?: string;
}

/**
 * List what is already running on a server, so an Operator can bring it under
 * management rather than deploying it again. This reads the server over SSH and
 * changes nothing on it.
 */
export function listNodeWorkloads(nodeId: string, signal?: AbortSignal): Promise<Workload[]> {
  return apiRequest<unknown>(`/nodes/${encodeURIComponent(nodeId)}/workloads`, { signal }).then(
    (r) => unwrap<Workload[]>(r, 'workloads'),
  );
}

/**
 * Bring one already running workload under management as a Service in a Project.
 * The workload keeps running untouched; it simply appears in the Workspace from
 * now on, where it can be started, stopped, watched, and read.
 */
export function adoptWorkload(nodeId: string, input: AdoptWorkloadInput): Promise<Service> {
  return apiRequest<unknown>(`/nodes/${encodeURIComponent(nodeId)}/workloads/adopt`, {
    method: 'POST',
    body: input,
  }).then((r) => unwrap<Service>(r, 'service'));
}

/**
 * File a Service under a different Project, so a workload adopted before its
 * Project existed can be put where it belongs. This moves the record only and
 * never touches the workload.
 */
export function moveServiceToProject(id: string, projectId: string): Promise<Service> {
  return apiRequest<unknown>(`/services/${id}/project`, {
    method: 'PATCH',
    body: { project_id: projectId },
  }).then((r) => unwrap<Service>(r, 'service'));
}
