import { ApiError } from './errors';
import { apiRequest, unwrap } from './http';

/*
 * The Docker control centre: what Docker is actually running on one Node.
 *
 * Every call here reads. Nothing in this module starts, stops, prunes, or
 * removes anything, because inspecting a Node must never change it, and an
 * Operator opening a screen has approved nothing. Lifecycle actions on a
 * container go through the Operation approval gate like every other change, and
 * do not belong on a read path.
 *
 * The Node is the unit, not the Workspace. Docker is a daemon on one machine;
 * there is no meaningful Workspace-wide container list, and pretending there is
 * would invent a fleet view out of six unrelated daemons.
 *
 * Field names mirror the backend contract exactly, snake_case included, so the
 * wire shape and the type cannot drift apart in a rename.
 */

/**
 * Who put this container there.
 *
 * `slideops` is a workload this app deployed and therefore knows how to act on.
 * `external` is one the Operator or another tool created, which SlideOps shows
 * but does not claim. `unknown` is the honest third answer: the daemon reported
 * a container carrying nothing that decides the question either way. It is not
 * a synonym for `external`, and a screen that merges the two states something
 * about provenance that nobody established.
 */
export type DockerOwnership = 'slideops' | 'external' | 'unknown';

/** The lifecycle state Docker itself reports for a container. */
export type DockerContainerState =
  'running' | 'exited' | 'paused' | 'restarting' | 'dead' | 'created';

/**
 * The healthcheck verdict.
 *
 * `none` means the image declares no healthcheck, which is not the same as
 * healthy: nobody is checking. `starting` is the grace period before the first
 * verdict, and is not a failure however long it has been going on.
 */
export type DockerHealth = 'healthy' | 'unhealthy' | 'starting' | 'none';

/**
 * One published port. `host_port` is absent when the port is exposed inside
 * Docker but not published to the Node, which is the common case for a database
 * behind a Compose network and must not read as "not reachable".
 */
export interface DockerPort {
  host_ip?: string;
  host_port?: number;
  container_port: number;
  protocol: string;
}

/** One container on the Node, as the daemon describes it. */
export interface DockerContainer {
  /** The full 64 character id, which is what other Docker records refer to. */
  full_id: string;
  /** The short id Docker prints, kept because it is what an Operator recognises. */
  id: string;
  name: string;
  image: string;
  image_id: string;
  state: DockerContainerState;
  /** Docker's own status line, such as "Up 3 hours (healthy)". */
  status_text: string;
  health: DockerHealth;
  created_at: string;
  /** When the current run began. Absent for a container that never started. */
  started_at?: string;
  restart_count: number;
  /** The code the last run exited with. Absent while the container is running. */
  exit_code?: number;
  restart_policy: string;
  ports: DockerPort[];
  compose_project?: string;
  compose_service?: string;
  ownership: DockerOwnership;
  /** The Service this container belongs to, when SlideOps deployed it. */
  service_id?: string;
  /** The CPU ceiling in cores. Absent when the Operator set no limit. */
  cpu_limit_cores?: number;
  /** The memory ceiling in whole MB. Absent when the Operator set no limit. */
  memory_limit_mb?: number;
  networks: string[];
  mount_count: number;
  labels: Record<string, string>;
}

/**
 * A live sample for one container, keyed by its full id.
 *
 * Separate from the container on purpose. Stats cost a sampling pass on the
 * Node and a container list does not, so a screen can list containers promptly
 * and let the numbers arrive after. It also means a container with no sample is
 * visibly a container with no sample, rather than one silently showing zero.
 */
export interface DockerStats {
  container_id: string;
  cpu_percent: number;
  memory_used_mb: number;
  /**
   * What Docker reports as the memory ceiling for this sample. Where the
   * container has no limit of its own, the daemon reports the whole machine's
   * memory here, so this is not evidence that a limit was set.
   */
  memory_limit_mb: number;
  net_rx_bytes: number;
  net_tx_bytes: number;
  block_read_bytes: number;
  block_write_bytes: number;
  pids: number;
}

/** One image on the Node. `containers` counts the containers using it. */
export interface DockerImage {
  id: string;
  repository: string;
  tag: string;
  created_at: string;
  size_bytes: number;
  /** An image left with no repository or tag, usually by a rebuild. */
  dangling: boolean;
  in_use: boolean;
  containers: number;
}

/** One volume on the Node. `containers` names what has it mounted. */
export interface DockerVolume {
  name: string;
  driver: string;
  mountpoint: string;
  created_at?: string;
  /** Absent unless the daemon was asked for disk usage, which is slow. */
  size_bytes?: number;
  in_use: boolean;
  containers: string[];
  labels: Record<string, string>;
}

/** One Docker network on the Node. `containers` names what is attached. */
export interface DockerNetwork {
  id: string;
  name: string;
  driver: string;
  scope: string;
  subnet?: string;
  gateway?: string;
  /** An internal network has no route out to the Node's own network. */
  internal: boolean;
  containers: string[];
  labels: Record<string, string>;
}

/**
 * The daemon itself. Everything but `available` and `warnings` is absent when
 * the daemon could not be reached, so a screen reads `available` first and asks
 * nothing else of this object until it is true.
 */
export interface DockerDaemon {
  available: boolean;
  version?: string;
  api_version?: string;
  storage_driver?: string;
  cgroup_driver?: string;
  kernel?: string;
  architecture?: string;
  /** Docker's own warnings about how it is configured, in its own words. */
  warnings: string[];
}

/** The tallies behind the overview, counted on the Node rather than in the UI. */
export interface DockerCounts {
  containers: number;
  running: number;
  stopped: number;
  paused: number;
  restarting: number;
  unhealthy: number;
  exited: number;
  dead: number;
  created: number;
  images: number;
  volumes: number;
  networks: number;
  compose_projects: number;
}

/**
 * What Docker is holding on disk, and how much of it could be released.
 *
 * The reclaimable figures are Docker's own, from the same accounting that backs
 * `docker system df`. They are reported, never estimated here.
 */
export interface DockerDiskUsage {
  images_bytes: number;
  images_reclaimable_bytes: number;
  containers_bytes: number;
  containers_reclaimable_bytes: number;
  volumes_bytes: number;
  volumes_reclaimable_bytes: number;
  build_cache_bytes: number;
  build_cache_reclaimable_bytes: number;
}

/** One read that answers "what is the state of Docker on this Node". */
export interface DockerOverview {
  daemon: DockerDaemon;
  counts: DockerCounts;
  disk: DockerDiskUsage;
}

/**
 * The error code the backend returns when Docker is not installed or its daemon
 * is not running on that Node.
 *
 * It arrives as a 409 rather than a 404 because the Node exists and the request
 * was well formed; the Node simply is not in a state where the question has an
 * answer.
 */
export const DOCKER_UNAVAILABLE_CODE = 'docker_unavailable';

/**
 * Whether a failure means "Docker is not there" rather than "something broke".
 *
 * This is the difference between a screen showing an empty state that offers to
 * install Docker, and a screen showing a red error about a request that failed.
 * The first is the truth on a Node that has never had Docker on it, and it is
 * the far more common case, so it is worth telling the two apart precisely
 * rather than treating every failure as a fault.
 *
 * Matched on the code and not on the status, because 409 is a perfectly
 * ordinary conflict elsewhere and must not be read as an absent daemon.
 */
export function isDockerUnavailable(error: unknown): boolean {
  return error instanceof ApiError && error.code === DOCKER_UNAVAILABLE_CODE;
}

/** The state of Docker on one Node: the daemon, the tallies, and the disk. */
export function getDockerOverview(nodeId: string, signal?: AbortSignal): Promise<DockerOverview> {
  return apiRequest<unknown>(`/nodes/${encodeURIComponent(nodeId)}/docker/overview`, {
    signal,
  }).then((r) => unwrap<DockerOverview>(r, 'overview'));
}

/** Every container on the Node, whoever created it. Reads only. */
export function listDockerContainers(
  nodeId: string,
  signal?: AbortSignal,
): Promise<DockerContainer[]> {
  return apiRequest<unknown>(`/nodes/${encodeURIComponent(nodeId)}/docker/containers`, {
    signal,
  }).then((r) => unwrap<DockerContainer[]>(r, 'containers'));
}

/**
 * A live sample per running container. Kept apart from the container list
 * because sampling costs a pass on the Node, and because a container the sample
 * does not cover must stay visibly uncovered.
 */
export function listDockerStats(nodeId: string, signal?: AbortSignal): Promise<DockerStats[]> {
  return apiRequest<unknown>(`/nodes/${encodeURIComponent(nodeId)}/docker/stats`, { signal }).then(
    (r) => unwrap<DockerStats[]>(r, 'stats'),
  );
}

/** Every image on the Node, including the dangling ones a rebuild left behind. */
export function listDockerImages(nodeId: string, signal?: AbortSignal): Promise<DockerImage[]> {
  return apiRequest<unknown>(`/nodes/${encodeURIComponent(nodeId)}/docker/images`, { signal }).then(
    (r) => unwrap<DockerImage[]>(r, 'images'),
  );
}

/** Every volume on the Node, and what still has each one mounted. */
export function listDockerVolumes(nodeId: string, signal?: AbortSignal): Promise<DockerVolume[]> {
  return apiRequest<unknown>(`/nodes/${encodeURIComponent(nodeId)}/docker/volumes`, {
    signal,
  }).then((r) => unwrap<DockerVolume[]>(r, 'volumes'));
}

/** Every Docker network on the Node, and what is attached to each. */
export function listDockerNetworks(nodeId: string, signal?: AbortSignal): Promise<DockerNetwork[]> {
  return apiRequest<unknown>(`/nodes/${encodeURIComponent(nodeId)}/docker/networks`, {
    signal,
  }).then((r) => unwrap<DockerNetwork[]>(r, 'networks'));
}

/**
 * The code a deployment answers with when the Docker workspace is not switched
 * on there.
 *
 * Distinct from an ordinary not_found on purpose: a screen shows one
 * explanation for "this deployment has not enabled the Docker workspace" and a
 * different one for "that server does not exist", and it cannot choose between
 * them from the status alone.
 */
export const DOCKER_NOT_ENABLED_CODE = 'docker_not_enabled';

/** Whether this deployment serves the Docker workspace at all. */
export function isDockerNotEnabled(error: unknown): boolean {
  return error instanceof ApiError && error.code === DOCKER_NOT_ENABLED_CODE;
}
