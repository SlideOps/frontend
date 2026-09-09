import type { Narrowed } from './contract';
import type * as wire from './docker-generated';
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
  'running' | 'exited' | 'paused' | 'restarting' | 'removing' | 'dead' | 'created';

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
export type DockerPort = Narrowed<
  wire.PortMapping,
  {
    /**
     * Absent when the port is exposed inside Docker but not published to the
     * Node. The server sends 0 there, which is not a port number; the seam
     * below turns it back into "there isn't one" so a screen cannot print it.
     */
    host_port?: number;
  }
>;

/** One container on the Node, as the daemon describes it. */
export type DockerContainer = Narrowed<
  wire.Container,
  {
    state: DockerContainerState;
    /** Absent when the image declares no healthcheck at all. */
    health?: DockerHealth;
    ownership: DockerOwnership;
    /** Guaranteed a list by the normaliser below, whatever the server sent. */
    ports: DockerPort[];
    networks: string[];
    labels: Record<string, string>;
    /**
     * The code the last run ended with, absent until a run has ended.
     *
     * Docker reports 0 for a container that is still going, which is the same
     * number a clean exit reports, so the field is only carried through for the
     * states where a run has actually finished. Otherwise a healthy container
     * reads as one that exited successfully and stopped, which is the opposite
     * of what it is doing.
     */
    exit_code?: number;
    /** The CPU ceiling in cores. Absent when the Operator set no limit. */
    cpu_limit_cores?: number;
    /** The memory ceiling in whole MB. Absent when the Operator set no limit. */
    memory_limit_mb?: number;
  }
>;

/**
 * A live sample for one container, keyed by its full id.
 *
 * Separate from the container on purpose. Stats cost a sampling pass on the
 * Node and a container list does not, so a screen can list containers promptly
 * and let the numbers arrive after. It also means a container with no sample is
 * visibly a container with no sample, rather than one silently showing zero.
 */
export type DockerStats = wire.Stats;

/** One image on the Node. `containers` counts the containers using it. */
export type DockerImage = wire.Image;

/** One volume on the Node. `containers` names what has it mounted. */
export type DockerVolume = Narrowed<
  wire.Volume,
  {
    containers: string[];
    labels: Record<string, string>;
    /**
     * Absent unless the daemon volunteered a size, which it only does when it
     * was asked for disk usage. The server marks that with -1 rather than 0,
     * because a volume holding nothing and a volume nobody measured are
     * different answers.
     */
    size_bytes?: number;
  }
>;

/** One Docker network on the Node. `containers` names what is attached. */
export type DockerNetwork = Narrowed<
  wire.Network,
  { containers: string[]; labels: Record<string, string> }
>;

/**
 * The daemon itself. Everything but `available` and `warnings` is absent when
 * the daemon could not be reached, so a screen reads `available` first and asks
 * nothing else of this object until it is true.
 */
export type DockerDaemon = Narrowed<wire.Daemon, { warnings: string[] }>;

/** The tallies behind the overview, counted on the Node rather than in the UI. */
export type DockerCounts = wire.Counts;

/**
 * What Docker is holding on disk, and how much of it could be released.
 *
 * The reclaimable figures are Docker's own, from the same accounting that backs
 * `docker system df`. They are reported, never estimated here.
 */
/**
 * One line of the accounting: how many objects of a kind there are, how many
 * are still in use, and how much of the total could be released.
 */
export type DockerDiskCategory = wire.DiskCategory;

export type DockerDiskUsage = wire.DiskUsage;

/** One read that answers "what is the state of Docker on this Node". */
export type DockerOverview = Narrowed<wire.Overview, { daemon: DockerDaemon }>;

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
/**
 * The overview, with the daemon's warning list guaranteed present.
 *
 * The field is omitted entirely when the daemon has nothing to complain about,
 * which is the healthy case and therefore the common one. Code that iterates it
 * to build the attention list then reads undefined, which is not an empty
 * warnings section, it is a page that stops rendering.
 */
function safeOverview(overview: wire.Overview): DockerOverview {
  return {
    ...overview,
    daemon: { ...overview.daemon, warnings: list(overview.daemon?.warnings) },
  };
}

export function getDockerOverview(nodeId: string, signal?: AbortSignal): Promise<DockerOverview> {
  return apiRequest<unknown>(`/nodes/${encodeURIComponent(nodeId)}/docker/overview`, {
    signal,
  }).then((r) => safeOverview(unwrap<wire.Overview>(r, 'overview')));
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
/**
 * A number the server sends unconditionally, using one value to mean "there
 * isn't one".
 *
 * Go has no absent int, so a limit nobody set arrives as 0 and a size nobody
 * measured arrives as -1. Both are sent every time, so a screen checking for
 * the field being missing never finds it missing, and prints the sentinel: an
 * unlimited container reads as capped at zero cores, an unmeasured volume as
 * holding -1 bytes. This is where the sentinel becomes the absence it stands
 * for, once, rather than at every place that formats a number.
 */
function reported(value: number, absent: number): number | undefined {
  return value === absent ? undefined : value;
}

/** The size a volume reports when the daemon never measured it. */
const SIZE_UNKNOWN = -1;

/**
 * The states in which a container has a finished run behind it.
 *
 * `restarting` counts: the previous run did end, and its code is the only
 * evidence a screen has for why the container keeps coming back.
 */
const STATES_WITH_AN_ENDED_RUN: readonly DockerContainerState[] = ['exited', 'dead', 'restarting'];

function safePort(port: wire.PortMapping): DockerPort {
  return { ...port, host_port: reported(port.host_port, 0) };
}

function list<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function record(value: Record<string, string> | null | undefined): Record<string, string> {
  return value && typeof value === 'object' ? value : {};
}

/**
 * One container, with every list and map guaranteed present.
 *
 * The argument is the generated wire type and the result is the app's, which is
 * the whole shape of this layer: the only functions allowed to hand out a
 * `DockerContainer` are the ones that have made its guarantees true.
 */
function safeContainer(container: wire.Container): DockerContainer {
  const state = container.state as DockerContainerState;
  return {
    ...container,
    state,
    health: container.health as DockerHealth | undefined,
    ownership: container.ownership as DockerOwnership,
    ports: list(container.ports).map(safePort),
    networks: list(container.networks),
    labels: record(container.labels),
    exit_code: STATES_WITH_AN_ENDED_RUN.includes(state) ? container.exit_code : undefined,
    cpu_limit_cores: reported(container.cpu_limit_cores, 0),
    memory_limit_mb: reported(container.memory_limit_mb, 0),
  };
}

function safeVolume(volume: wire.Volume): DockerVolume {
  return {
    ...volume,
    containers: list(volume.containers),
    labels: record(volume.labels),
    size_bytes: reported(volume.size_bytes, SIZE_UNKNOWN),
  };
}

function safeNetwork(network: wire.Network): DockerNetwork {
  return { ...network, containers: list(network.containers), labels: record(network.labels) };
}

/**
 * One inspect, with every list guaranteed present.
 *
 * This is the read that broke most often, and always the same way: a container
 * with no entrypoint, no aliases on its network, or no mounts arrives with
 * those fields as null, and a detail panel that walks them renders nothing at
 * all rather than an empty section. Every list in the payload is settled here
 * so no panel has to remember which of them the daemon leaves empty.
 */
function safeInspect(inspect: wire.Inspect): DockerInspect {
  return {
    ...inspect,
    general: { ...inspect.general, ownership: inspect.general.ownership as DockerOwnership },
    configuration: {
      ...inspect.configuration,
      command: list(inspect.configuration.command),
      entrypoint: list(inspect.configuration.entrypoint),
      labels: record(inspect.configuration.labels),
    },
    networking: {
      ...inspect.networking,
      networks: list(inspect.networking.networks).map((network) => ({
        ...network,
        aliases: list(network.aliases),
      })),
      ports: list(inspect.networking.ports).map(safePort),
      dns: list(inspect.networking.dns),
    },
    storage: { ...inspect.storage, mounts: list(inspect.storage.mounts) },
    runtime: {
      ...inspect.runtime,
      healthcheck: inspect.runtime.healthcheck
        ? { ...inspect.runtime.healthcheck, test: list(inspect.runtime.healthcheck.test) }
        : undefined,
    },
  };
}

export function listDockerContainers(
  nodeId: string,
  signal?: AbortSignal,
): Promise<DockerContainer[]> {
  return apiRequest<unknown>(`/nodes/${encodeURIComponent(nodeId)}/docker/containers`, {
    signal,
  }).then((r) => list(unwrap<wire.Container[]>(r, 'containers')).map(safeContainer));
}

/**
 * A live sample per running container. Kept apart from the container list
 * because sampling costs a pass on the Node, and because a container the sample
 * does not cover must stay visibly uncovered.
 */
export function listDockerStats(nodeId: string, signal?: AbortSignal): Promise<DockerStats[]> {
  return apiRequest<unknown>(`/nodes/${encodeURIComponent(nodeId)}/docker/stats`, { signal }).then(
    (r) => list(unwrap<wire.Stats[]>(r, 'stats')),
  );
}

/** Every image on the Node, including the dangling ones a rebuild left behind. */
export function listDockerImages(nodeId: string, signal?: AbortSignal): Promise<DockerImage[]> {
  return apiRequest<unknown>(`/nodes/${encodeURIComponent(nodeId)}/docker/images`, { signal }).then(
    (r) => list(unwrap<wire.Image[]>(r, 'images')),
  );
}

/** Every volume on the Node, and what still has each one mounted. */
export function listDockerVolumes(nodeId: string, signal?: AbortSignal): Promise<DockerVolume[]> {
  return apiRequest<unknown>(`/nodes/${encodeURIComponent(nodeId)}/docker/volumes`, {
    signal,
  }).then((r) => list(unwrap<wire.Volume[]>(r, 'volumes')).map(safeVolume));
}

/** Every Docker network on the Node, and what is attached to each. */
export function listDockerNetworks(nodeId: string, signal?: AbortSignal): Promise<DockerNetwork[]> {
  return apiRequest<unknown>(`/nodes/${encodeURIComponent(nodeId)}/docker/networks`, {
    signal,
  }).then((r) => list(unwrap<wire.Network[]>(r, 'networks')).map(safeNetwork));
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

/** What the container is and when it came to exist. */
export type DockerInspectGeneral = Narrowed<wire.InspectGeneral, { ownership: DockerOwnership }>;

/**
 * What the container was configured to run.
 *
 * command and entrypoint are lists, not strings, because that is what Docker
 * stores and what an argument containing a space means. Joining them for
 * display is the screen's business; carrying them joined would lose which
 * argument was which.
 *
 * There is deliberately no environment here. See the note on the endpoint.
 */
export type DockerInspectConfiguration = Narrowed<
  wire.InspectConfiguration,
  { command: string[]; entrypoint: string[]; labels: Record<string, string> }
>;

export type DockerInspectResources = wire.InspectResources;

/** One network the container is attached to, with its address on that network. */
export type DockerInspectNetwork = Narrowed<wire.InspectNetwork, { aliases: string[] }>;

export type DockerInspectNetworking = Narrowed<
  wire.InspectNetworking,
  { networks: DockerInspectNetwork[]; ports: DockerPort[]; dns: string[] }
>;

/** One mount, whether a named volume or a path from the host. */
export type DockerMount = wire.InspectMount;

export type DockerInspectStorage = Narrowed<wire.InspectStorage, { mounts: DockerMount[] }>;

/** The healthcheck the image declares, if it declares one. */
export type DockerHealthcheck = Narrowed<wire.InspectHealthcheck, { test: string[] }>;

/** The last time the healthcheck ran. */
export type DockerHealthResult = wire.InspectHealthResult;

export type DockerInspectRuntime = Narrowed<
  wire.InspectRuntime,
  {
    healthcheck?: DockerHealthcheck;
  }
>;

export type DockerInspect = Narrowed<
  wire.Inspect,
  {
    general: DockerInspectGeneral;
    configuration: DockerInspectConfiguration;
    networking: DockerInspectNetworking;
    storage: DockerInspectStorage;
    runtime: DockerInspectRuntime;
  }
>;

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
  ).then((r) => safeInspect(unwrap<wire.Inspect>(r, 'inspect')));
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
  ).then((r) => safeContainer(unwrap<wire.Container>(r, 'container')));
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
