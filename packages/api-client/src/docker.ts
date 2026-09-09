import { ApiError } from './errors';
import { apiRequest, unwrap } from './http';

/*
 * The Docker control centre: what Docker is actually running on one Node.
 *
 * The reads come first and are the bulk of it: opening a screen must never
 * change a Node, so nothing on the read path starts, stops, prunes or removes
 * anything. The lifecycle calls at the foot of the file are the other half, and
 * every one of them is reached only from a control the Operator pressed. None
 * of them is issued to populate a view.
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

/*
 * Making the wire safe to render.
 *
 * Go marshals a nil slice as JSON null, not as an empty array, and a nil slice
 * is the ordinary result of a query that found nothing: a container with no
 * published ports, a network with nothing attached, a stack discovered from
 * labels with no images recorded. A screen reading `.length` on one of those
 * does not draw an empty section, it throws, and React unmounts the tree, which
 * is a blank page and a console error rather than an empty list.
 *
 * Guarding at every call site was tried and is the wrong shape: it has to be
 * remembered forever, by everyone, in a component nobody has written yet. This
 * is the one place the wire is turned into values the app renders, so it is the
 * place the guarantee belongs. Arrays are arrays and records are records from
 * here on, whatever the server sent.
 */
function list<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function record(value: Record<string, string> | null | undefined): Record<string, string> {
  return value && typeof value === 'object' ? value : {};
}

/** One container, with every list and map guaranteed present. */
function safeContainer(container: DockerContainer): DockerContainer {
  return {
    ...container,
    ports: list(container.ports),
    networks: list(container.networks),
    labels: record(container.labels),
  };
}

function safeVolume(volume: DockerVolume): DockerVolume {
  return { ...volume, containers: list(volume.containers), labels: record(volume.labels) };
}

function safeNetwork(network: DockerNetwork): DockerNetwork {
  return { ...network, containers: list(network.containers), labels: record(network.labels) };
}

export function listDockerContainers(
  nodeId: string,
  signal?: AbortSignal,
): Promise<DockerContainer[]> {
  return apiRequest<unknown>(`/nodes/${encodeURIComponent(nodeId)}/docker/containers`, {
    signal,
  }).then((r) => list(unwrap<DockerContainer[]>(r, 'containers')).map(safeContainer));
}

/**
 * A live sample per running container. Kept apart from the container list
 * because sampling costs a pass on the Node, and because a container the sample
 * does not cover must stay visibly uncovered.
 */
export function listDockerStats(nodeId: string, signal?: AbortSignal): Promise<DockerStats[]> {
  return apiRequest<unknown>(`/nodes/${encodeURIComponent(nodeId)}/docker/stats`, { signal }).then(
    (r) => list(unwrap<DockerStats[]>(r, 'stats')),
  );
}

/** Every image on the Node, including the dangling ones a rebuild left behind. */
export function listDockerImages(nodeId: string, signal?: AbortSignal): Promise<DockerImage[]> {
  return apiRequest<unknown>(`/nodes/${encodeURIComponent(nodeId)}/docker/images`, { signal }).then(
    (r) => list(unwrap<DockerImage[]>(r, 'images')),
  );
}

/** Every volume on the Node, and what still has each one mounted. */
export function listDockerVolumes(nodeId: string, signal?: AbortSignal): Promise<DockerVolume[]> {
  return apiRequest<unknown>(`/nodes/${encodeURIComponent(nodeId)}/docker/volumes`, {
    signal,
  }).then((r) => list(unwrap<DockerVolume[]>(r, 'volumes')).map(safeVolume));
}

/** Every Docker network on the Node, and what is attached to each. */
export function listDockerNetworks(nodeId: string, signal?: AbortSignal): Promise<DockerNetwork[]> {
  return apiRequest<unknown>(`/nodes/${encodeURIComponent(nodeId)}/docker/networks`, {
    signal,
  }).then((r) => list(unwrap<DockerNetwork[]>(r, 'networks')).map(safeNetwork));
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

/* ------------------------------------------------------------------ *
 * Inspecting one container
 * ------------------------------------------------------------------ */

/**
 * One filesystem the container has attached, however it was attached.
 *
 * `name` is the Docker volume's name and is present only for a volume mount; a
 * bind mount has a path on the Node and no name, and a tmpfs has neither. The
 * distinction matters because a named volume survives the container being
 * removed and a tmpfs does not, which is the difference between a database that
 * still exists tomorrow and one that does not.
 */
export interface DockerMount {
  type: string;
  source: string;
  destination: string;
  read_only: boolean;
  name?: string;
}

/**
 * The healthcheck the image declares, and what came of it last.
 *
 * `test` is Docker's own array form, dispatch token included ("CMD-SHELL", then
 * the command). `last_status` is absent when the check has never produced a
 * verdict, which is a real state and not a synonym for unhealthy: a container
 * inside its start period has been checked by nobody yet.
 */
export interface DockerHealthcheck {
  test: string[];
  interval_seconds?: number;
  retries?: number;
  last_status?: string;
  last_output?: string;
}

/** What the container is and when it came to exist. */
export interface DockerInspectGeneral {
  id: string;
  name: string;
  created_at: string;
  state: string;
  status: string;
  platform: string;
  runtime: string;
}

/**
 * How the container was configured to run.
 *
 * There is deliberately no environment here, and there must never be one. A
 * container's environment is where database passwords, API keys and signing
 * secrets live, and an inspect panel is a screen that gets left open, screen
 * shared and pasted into a support thread. SlideOps does not carry those values
 * to the browser at all, so no screen can leak what it was never given.
 */
export interface DockerInspectConfiguration {
  image: string;
  command: string;
  entrypoint: string;
  working_dir: string;
  user: string;
  labels: Record<string, string>;
}

/**
 * The ceilings and floors set on the container. Every field is optional because
 * every one of them is optional in Docker: an absent limit means the Operator
 * set none, and the container may use whatever the Node has.
 */
export interface DockerInspectResources {
  cpu_limit_cores?: number;
  cpu_reservation_cores?: number;
  cpu_shares?: number;
  memory_limit_mb?: number;
  memory_reservation_mb?: number;
  pids_limit?: number;
}

/** What the container is attached to, and what can reach it. */
export interface DockerInspectNetworking {
  networks: string[];
  /** The container's address on each network it joined, keyed by network name. */
  ip_addresses: Record<string, string>;
  ports: DockerPort[];
  dns: string[];
  hostname: string;
}

/** What the container has mounted. */
export interface DockerInspectStorage {
  mounts: DockerMount[];
}

/**
 * How the container has behaved while running. `pid` and `exit_code` are
 * mutually exclusive in practice: a running container has a process id and has
 * not exited, and an exited one has a code and no process.
 */
export interface DockerInspectRuntime {
  restart_policy: string;
  restart_count: number;
  healthcheck?: DockerHealthcheck;
  oom_killed: boolean;
  pid?: number;
  exit_code?: number;
}

/**
 * Everything the daemon knows about one container, grouped the way it is read
 * rather than the way Docker nests it.
 *
 * `docker inspect` returns a deep tree in which the same fact appears in two
 * places and half the keys are historical. The backend flattens it into these
 * six sections so the client never has to know which of `HostConfig`,
 * `Config` or `State` a given field happens to live under this year.
 */
export interface DockerInspect {
  general: DockerInspectGeneral;
  configuration: DockerInspectConfiguration;
  resources: DockerInspectResources;
  networking: DockerInspectNetworking;
  storage: DockerInspectStorage;
  runtime: DockerInspectRuntime;
}

/**
 * Everything about one container. Reads only, however much detail it returns.
 *
 * `ref` is whatever identifies the container to the daemon: the full id, the
 * short id, or the name. It is encoded rather than trusted, because a container
 * name is chosen by whoever created the container and a slash in one must not
 * become a path segment here.
 */
export function inspectDockerContainer(
  nodeId: string,
  ref: string,
  signal?: AbortSignal,
): Promise<DockerInspect> {
  return apiRequest<unknown>(
    `/nodes/${encodeURIComponent(nodeId)}/docker/containers/${encodeURIComponent(ref)}/inspect`,
    { signal },
  ).then((r) => unwrap<DockerInspect>(r, 'inspect'));
}

/* ------------------------------------------------------------------ *
 * Acting on one container
 * ------------------------------------------------------------------ */

/**
 * The lifecycle actions that change a running container's state without
 * destroying it.
 *
 * Removal is not one of them and is a separate call on purpose. These six are
 * reversible -- a stopped container starts again, a paused one unpauses -- and
 * removal is not, so it does not belong behind the same generic verb where a
 * screen could reach it by passing a different string.
 */
export type DockerContainerAction = 'start' | 'stop' | 'restart' | 'pause' | 'unpause' | 'kill';

/**
 * Run one lifecycle action and return the container as it stands afterwards.
 *
 * The response is the container itself rather than an acknowledgement, so a
 * screen shows the state the daemon reports rather than the state it assumed
 * the action produced. A stop that left a container in `restarting` because a
 * policy brought it back must read as `restarting`, not as `exited` because
 * that is what stopping usually means.
 *
 * Exported alongside the six named calls because a row of lifecycle buttons is
 * one control with six values, and writing it as a switch over six imports
 * would put the mapping in the screen instead of here.
 */
export function runDockerContainerAction(
  nodeId: string,
  ref: string,
  action: DockerContainerAction,
): Promise<DockerContainer> {
  return apiRequest<unknown>(
    `/nodes/${encodeURIComponent(nodeId)}/docker/containers/${encodeURIComponent(ref)}/${action}`,
    { method: 'POST' },
  ).then((r) => unwrap<DockerContainer>(r, 'container'));
}

/** Start a stopped container. */
export function startDockerContainer(nodeId: string, ref: string): Promise<DockerContainer> {
  return runDockerContainerAction(nodeId, ref, 'start');
}

/** Stop a running container, giving its process the chance to shut down. */
export function stopDockerContainer(nodeId: string, ref: string): Promise<DockerContainer> {
  return runDockerContainerAction(nodeId, ref, 'stop');
}

/** Stop and start a container in one step. */
export function restartDockerContainer(nodeId: string, ref: string): Promise<DockerContainer> {
  return runDockerContainerAction(nodeId, ref, 'restart');
}

/** Freeze every process in the container, leaving it in memory. */
export function pauseDockerContainer(nodeId: string, ref: string): Promise<DockerContainer> {
  return runDockerContainerAction(nodeId, ref, 'pause');
}

/** Resume a paused container. */
export function unpauseDockerContainer(nodeId: string, ref: string): Promise<DockerContainer> {
  return runDockerContainerAction(nodeId, ref, 'unpause');
}

/**
 * Kill a container outright. Unlike stopping, this gives the process no chance
 * to finish what it was doing, so a screen offering it must say so.
 */
export function killDockerContainer(nodeId: string, ref: string): Promise<DockerContainer> {
  return runDockerContainerAction(nodeId, ref, 'kill');
}

/** What removal is allowed to take with it. Both are decisions the Operator
 *  makes explicitly, so neither has a default here. */
export interface DockerContainerRemoval {
  /** Remove the container even while it is running, killing it first. */
  force: boolean;
  /**
   * Remove the anonymous volumes created with the container.
   *
   * Anonymous only: named volumes survive, because they are shared and outlive
   * whatever container happened to mount them. This is still the destructive
   * half of the call, and it is the one that loses data.
   */
  remove_volumes: boolean;
}

/**
 * Remove a container.
 *
 * Returns nothing. The backend answers with the container's last state, but a
 * removed container has no state left to be true about: by the time a screen
 * reads it, the thing it describes does not exist on the Node. Handing that
 * object back would invite a panel to keep rendering a container that is gone,
 * so the call resolves empty and the screen re-reads the Node instead.
 */
export function removeDockerContainer(
  nodeId: string,
  ref: string,
  removal: DockerContainerRemoval,
): Promise<void> {
  return apiRequest<unknown>(
    `/nodes/${encodeURIComponent(nodeId)}/docker/containers/${encodeURIComponent(ref)}`,
    { method: 'DELETE', body: removal },
  ).then(() => undefined);
}

/**
 * The code the backend returns when a container may not be removed here because
 * a SlideOps Service owns it.
 *
 * Removing it behind the Service's back would leave the Service describing a
 * container that no longer exists, and the next deploy would fight whatever the
 * Operator did by hand. The refusal names the Service so the screen can send
 * them to the place where the same change is a supported one.
 */
export const MANAGED_BY_SERVICE_CODE = 'managed_by_service';

/**
 * Whether the failure means "a Service owns this container" rather than
 * "removal failed".
 *
 * Matched on the code and not the status, for the same reason as
 * {@link isDockerUnavailable}: 409 is an ordinary conflict throughout this API.
 */
export function isManagedByService(error: unknown): boolean {
  return error instanceof ApiError && error.code === MANAGED_BY_SERVICE_CODE;
}

/**
 * The Service that owns the container, read off the refusal, or null when the
 * error carries no id.
 *
 * Null is a real answer and a screen must handle it: the sentence "a Service
 * manages this container" is still true and still worth saying without a link
 * to follow. Guessing an id, or linking to a Service page with an empty id,
 * would send an Operator somewhere that does not exist.
 */
export function managedByServiceId(error: unknown): string | null {
  if (!isManagedByService(error)) {
    return null;
  }
  const details = (error as ApiError).details;
  if (typeof details === 'string' && details) {
    return details;
  }
  if (details && typeof details === 'object') {
    const id = (details as Record<string, unknown>).service_id;
    if (typeof id === 'string' && id) {
      return id;
    }
  }
  return null;
}
