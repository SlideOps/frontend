import { ApiError } from './errors';
import { apiRequest, unwrap } from './http';
import type { DockerNetwork, DockerVolume } from './docker';

/*
 * Acting on what Docker holds on one Node: its images, its volumes, its
 * networks, and the disk it can release.
 *
 * The reads for all four already live in docker.ts and stay there. This file is
 * the other half, and every call in it changes a Node. Not one of them is
 * issued to populate a view: each is reached only from a control the Operator
 * pressed, after the screen said what it was about to do.
 *
 * The refusals are the interesting part. Docker declines these operations for
 * good reasons far more often than they fail, and the three it declines for are
 * different enough that a screen must tell them apart:
 *
 * - `in_use`: something still depends on this. Nothing was changed, and the
 *   refusal names what is depending on it, so the Operator can go and deal with
 *   that instead of forcing their way through.
 * - `protected_network`: `bridge`, `host` and `none` are Docker's own and
 *   removing one would break every container on the Node. This is the refusal a
 *   screen should never actually see, because the control should not have been
 *   offered.
 * - `confirmation_required`: the request would destroy data the Operator did
 *   not say they were willing to lose. It is a request for consent, not a
 *   failure, and must never be retried automatically with the flag flipped on.
 *
 * Field names mirror the backend contract exactly, snake_case included.
 */

/* ------------------------------------------------------------------ *
 * Refusals
 * ------------------------------------------------------------------ */

/** Something still depends on this image, volume or network. */
export const DOCKER_IN_USE_CODE = 'in_use';

/** `bridge`, `host` or `none`: Docker's own networks, which it will not remove. */
export const DOCKER_PROTECTED_NETWORK_CODE = 'protected_network';

/** The request would destroy data, and nobody has said that is acceptable yet. */
export const DOCKER_CONFIRMATION_REQUIRED_CODE = 'confirmation_required';

/**
 * Whether the failure means "something is still using this" rather than
 * "the removal broke".
 *
 * Matched on the code and never on the status, for the same reason the rest of
 * this client does: 409 is an ordinary conflict throughout this API, and
 * reading every conflict as a dependency would put the names of containers into
 * a sentence about a problem that had nothing to do with containers.
 */
export function isDockerResourceInUse(error: unknown): boolean {
  return error instanceof ApiError && error.code === DOCKER_IN_USE_CODE;
}

/** Whether the failure is Docker refusing to remove one of its own networks. */
export function isDockerProtectedNetwork(error: unknown): boolean {
  return error instanceof ApiError && error.code === DOCKER_PROTECTED_NETWORK_CODE;
}

/**
 * Whether the failure is a request for consent to destroy data.
 *
 * A screen that reads this must put the decision back to the Operator. Retrying
 * the same call with `confirm_data_loss` set, because the backend asked for it,
 * would turn the one safeguard on this surface into a formality.
 */
export function isDockerConfirmationRequired(error: unknown): boolean {
  return error instanceof ApiError && error.code === DOCKER_CONFIRMATION_REQUIRED_CODE;
}

/**
 * The containers named by an `in_use` refusal, or an empty list when it named
 * none in a form we can read.
 *
 * An empty list is a real answer, and the caller must keep the refusal's own
 * message on screen regardless: the sentence "something is still using this"
 * is worth saying whether or not it comes with a list to show beside it.
 * Inventing a name, or rendering an empty list as though the answer were "no
 * containers", would both be worse than the message alone.
 */
export function dockerInUseContainers(error: unknown): string[] {
  if (!isDockerResourceInUse(error)) {
    return [];
  }
  const details = (error as ApiError).details;
  if (!details || typeof details !== 'object') {
    return [];
  }
  const named = (details as Record<string, unknown>).containers;
  if (!Array.isArray(named)) {
    return [];
  }
  return named.filter((entry): entry is string => typeof entry === 'string' && entry !== '');
}

/* ------------------------------------------------------------------ *
 * Inspecting an image, a volume or a network
 * ------------------------------------------------------------------ */

/**
 * The daemon's own record for one image, volume or network, passed through as
 * it arrived.
 *
 * Unlike a container's inspect, which the backend flattens into six named
 * sections because everything in it is worth reading, these three are mostly
 * driver options and internal bookkeeping whose shape varies with the driver in
 * use. Pinning a type to that would be a type that goes out of date on a Node
 * running a storage driver we did not think of, so the record is carried
 * verbatim and the screen renders whatever keys are actually in it.
 */
export type DockerResourceInspect = Record<string, unknown>;

/* ------------------------------------------------------------------ *
 * Images
 * ------------------------------------------------------------------ */

/**
 * Pull an image onto the Node.
 *
 * `reference` is what an Operator would type after `docker pull`: a repository
 * with an optional tag or digest, such as `nginx:latest`. It is sent as given
 * rather than being split or defaulted here, because a client that quietly
 * appends `:latest` to a bare repository is a client that pulls something other
 * than what was asked for.
 *
 * This resolves when the pull has finished, which on a slow link and a large
 * image is minutes rather than seconds. The endpoint streams its progress and a
 * later screen will read that stream; until then a caller must treat this as a
 * long request, say so while it runs, and re-read the image list afterwards
 * rather than assuming what landed.
 */
export function pullDockerImage(
  nodeId: string,
  reference: string,
  signal?: AbortSignal,
): Promise<void> {
  return apiRequest<unknown>(`/nodes/${encodeURIComponent(nodeId)}/docker/images/pull`, {
    method: 'POST',
    body: { reference },
    signal,
  }).then(() => undefined);
}

/**
 * Remove an image.
 *
 * `force` removes it even where a stopped container still references it, so it
 * is a decision the Operator makes explicitly and has no default here. Removing
 * an image a running container needs is refused whatever this says.
 */
export function removeDockerImage(nodeId: string, imageId: string, force: boolean): Promise<void> {
  return apiRequest<unknown>(
    `/nodes/${encodeURIComponent(nodeId)}/docker/images/${encodeURIComponent(imageId)}`,
    { method: 'DELETE', body: { force } },
  ).then(() => undefined);
}

/**
 * Give an image another name.
 *
 * Tagging adds a reference and never moves the image, so an image with two tags
 * is one image. This is the one operation on this surface that destroys
 * nothing, which is why it is not behind a confirmation anywhere.
 */
export function tagDockerImage(nodeId: string, imageId: string, reference: string): Promise<void> {
  return apiRequest<unknown>(
    `/nodes/${encodeURIComponent(nodeId)}/docker/images/${encodeURIComponent(imageId)}/tag`,
    { method: 'POST', body: { reference } },
  ).then(() => undefined);
}

/** Everything the daemon knows about one image. Reads only. */
export function inspectDockerImage(
  nodeId: string,
  imageId: string,
  signal?: AbortSignal,
): Promise<DockerResourceInspect> {
  return apiRequest<unknown>(
    `/nodes/${encodeURIComponent(nodeId)}/docker/images/${encodeURIComponent(imageId)}/inspect`,
    { signal },
  ).then((r) => unwrap<DockerResourceInspect>(r, 'image'));
}

/* ------------------------------------------------------------------ *
 * Volumes
 * ------------------------------------------------------------------ */

/**
 * A new volume. Only the name is required; the driver is Docker's `local`
 * unless the Operator names another, and labels are their own vocabulary rather
 * than anything SlideOps reads.
 */
export interface CreateDockerVolumeInput {
  name: string;
  driver?: string;
  labels?: Record<string, string>;
}

/** Create a volume, and hand back the volume the daemon actually created. */
export function createDockerVolume(
  nodeId: string,
  input: CreateDockerVolumeInput,
): Promise<DockerVolume> {
  return apiRequest<unknown>(`/nodes/${encodeURIComponent(nodeId)}/docker/volumes`, {
    method: 'POST',
    body: input,
  }).then((r) => unwrap<DockerVolume>(r, 'volume'));
}

/**
 * Remove a volume.
 *
 * This is the one call in this file that loses something that cannot be pulled
 * again: an image comes back from a registry and a network is a line of
 * configuration, but a volume is the database. Nothing here can make that safe,
 * so the call is deliberately plain and the weight sits on the screen calling
 * it, which must name the volume and what is mounting it before it gets here.
 *
 * Resolves empty. A removed volume has no state left to describe.
 */
export function removeDockerVolume(nodeId: string, name: string, force: boolean): Promise<void> {
  return apiRequest<unknown>(
    `/nodes/${encodeURIComponent(nodeId)}/docker/volumes/${encodeURIComponent(name)}`,
    { method: 'DELETE', body: { force } },
  ).then(() => undefined);
}

/** Everything the daemon knows about one volume. Reads only. */
export function inspectDockerVolume(
  nodeId: string,
  name: string,
  signal?: AbortSignal,
): Promise<DockerResourceInspect> {
  return apiRequest<unknown>(
    `/nodes/${encodeURIComponent(nodeId)}/docker/volumes/${encodeURIComponent(name)}/inspect`,
    { signal },
  ).then((r) => unwrap<DockerResourceInspect>(r, 'volume'));
}

/* ------------------------------------------------------------------ *
 * Networks
 * ------------------------------------------------------------------ */

/**
 * A new network. Everything but the name is optional because everything but the
 * name has a Docker default, and a client that fills those in itself decides
 * the Node's addressing on the Operator's behalf.
 */
export interface CreateDockerNetworkInput {
  name: string;
  driver?: string;
  /** CIDR, such as `10.10.0.0/24`. Docker allocates one when this is absent. */
  subnet?: string;
  gateway?: string;
  /** An internal network has no route out to the Node's own network. */
  internal?: boolean;
}

/** Create a network, and hand back the network the daemon actually created. */
export function createDockerNetwork(
  nodeId: string,
  input: CreateDockerNetworkInput,
): Promise<DockerNetwork> {
  return apiRequest<unknown>(`/nodes/${encodeURIComponent(nodeId)}/docker/networks`, {
    method: 'POST',
    body: input,
  }).then((r) => unwrap<DockerNetwork>(r, 'network'));
}

/**
 * Remove a network.
 *
 * There is no force here and there is no body at all, because Docker offers
 * neither: a network with a container attached is refused with `in_use`, and
 * one of Docker's own three is refused with `protected_network`. Both refusals
 * are the correct outcome and neither is worth an override.
 */
export function removeDockerNetwork(nodeId: string, networkId: string): Promise<void> {
  return apiRequest<unknown>(
    `/nodes/${encodeURIComponent(nodeId)}/docker/networks/${encodeURIComponent(networkId)}`,
    { method: 'DELETE' },
  ).then(() => undefined);
}

/**
 * Attach a container to a network.
 *
 * `container` is whatever names the container to the daemon: its name, its
 * short id or its full id. It is encoded rather than trusted, because the name
 * was chosen by whoever created the container.
 */
export function connectDockerNetwork(
  nodeId: string,
  networkId: string,
  container: string,
): Promise<void> {
  return apiRequest<unknown>(
    `/nodes/${encodeURIComponent(nodeId)}/docker/networks/${encodeURIComponent(networkId)}/connect`,
    { method: 'POST', body: { container } },
  ).then(() => undefined);
}

/**
 * Detach a container from a network.
 *
 * Reversible, but not harmless: a container detached from the network its
 * dependencies are on stays up and stops being able to reach them, which looks
 * from the outside like the application breaking for no reason. A screen
 * offering this says so first.
 */
export function disconnectDockerNetwork(
  nodeId: string,
  networkId: string,
  container: string,
): Promise<void> {
  return apiRequest<unknown>(
    `/nodes/${encodeURIComponent(nodeId)}/docker/networks/${encodeURIComponent(networkId)}/disconnect`,
    { method: 'POST', body: { container } },
  ).then(() => undefined);
}

/* ------------------------------------------------------------------ *
 * Cleanup
 * ------------------------------------------------------------------ */

/**
 * One kind of thing Docker could release, counted and measured by the daemon.
 *
 * `key` is what the cleanup call takes and is stable; `label` is the daemon's
 * own words for the category and is what an Operator reads. `count` and
 * `reclaimable_bytes` are Docker's own accounting, the same figures behind
 * `docker system df`, reported rather than estimated here.
 */
export interface DockerCleanupCategory {
  key: string;
  label: string;
  count: number;
  reclaimable_bytes: number;
}

/** What could be released on this Node, one entry per category. */
export interface DockerCleanupPreview {
  categories: DockerCleanupCategory[];
}

/**
 * Read what could be released. Changes nothing: this is the read that lets a
 * screen say what each button would do before anybody presses one.
 */
/** One reclaim as the endpoint reports it, before it is given a human label. */
interface DockerCleanupPlan {
  kind: string;
  item_count: number;
  /** The objects it would remove, where they can be named. */
  targets?: string[] | null;
  reclaimable_bytes: number;
}

/**
 * What each reclaim is called, in words.
 *
 * The endpoint names a reclaim by its slug because that is what the POST takes
 * back. A screen needs a sentence, and inventing one from the slug would give
 * "Unused volumes" and "Build cache" the same weight when only one of them
 * destroys data.
 */
const CLEANUP_LABELS: Record<string, string> = {
  'build-cache': 'Build cache',
  'stopped-containers': 'Stopped containers',
  'dangling-images': 'Dangling images',
  'unused-images': 'Unused images',
  'unused-volumes': 'Unused volumes',
};

/**
 * Read what could be released. Changes nothing: this is the read that lets a
 * screen say what each button would do before anybody presses one.
 *
 * The endpoint answers with plans keyed by slug, and this is the one place that
 * turns them into the categories a screen renders. Doing it here rather than in
 * the panel keeps the wire shape in the module that owns the wire, and means a
 * plan the server adds later appears with its slug as its own label instead of
 * disappearing.
 */
export function previewDockerCleanup(
  nodeId: string,
  signal?: AbortSignal,
): Promise<DockerCleanupPreview> {
  return apiRequest<{ plans?: DockerCleanupPlan[] | null }>(
    `/nodes/${encodeURIComponent(nodeId)}/docker/cleanup/preview`,
    { signal },
  ).then((response) => ({
    // A server that reports no plans at all is an empty list, never a crash:
    // Go marshals an empty slice as null, and a screen mapping over null is a
    // blank page.
    categories: (response.plans ?? []).map((plan) => ({
      key: plan.kind,
      label: CLEANUP_LABELS[plan.kind] ?? plan.kind,
      count: plan.item_count,
      reclaimable_bytes: plan.reclaimable_bytes,
    })),
  }));
}

/** What a cleanup actually released. */
export interface DockerCleanupResult {
  /**
   * Absent when the Node reported no figure. Not zero: "the daemon did not say"
   * and "the daemon said nothing was released" are different answers, and a
   * screen that renders the first as `0 B` is stating something nobody
   * established.
   */
  reclaimed_bytes?: number;
}

/**
 * Release one category.
 *
 * One category per call, on purpose. There is no argument this function could
 * take that means "everything", because the categories are not comparable:
 * stopped containers and a build cache are Docker's own leftovers, and unused
 * volumes are the Operator's data that no container happens to be holding open
 * right now. A single control over both would eventually delete a database
 * somebody meant to keep, and it would do it on a click that read as
 * housekeeping.
 *
 * `confirmDataLoss` exists for exactly that reason. The backend refuses a
 * data-bearing category without it, and the flag must only ever be set because
 * an Operator said so, never because the first attempt was refused.
 */
export function runDockerCleanup(
  nodeId: string,
  category: string,
  confirmDataLoss = false,
): Promise<DockerCleanupResult> {
  return apiRequest<unknown>(`/nodes/${encodeURIComponent(nodeId)}/docker/cleanup`, {
    method: 'POST',
    body: { category, confirm_data_loss: confirmDataLoss },
  }).then((r) => readCleanupResult(r));
}

/**
 * Read the reclaimed figure without inventing one.
 *
 * The backend answers `{reclaimed_bytes}` bare rather than under an envelope
 * key, and a build that answered differently, or answered with nothing at all,
 * must leave the figure absent rather than reporting a release of zero bytes.
 */
function readCleanupResult(body: unknown): DockerCleanupResult {
  if (body && typeof body === 'object') {
    // The endpoint answers under `cleanup`; older builds answered bare, and
    // both are read rather than assuming one.
    const envelope = (body as Record<string, unknown>).cleanup;
    const source = (envelope && typeof envelope === 'object' ? envelope : body) as Record<
      string,
      unknown
    >;
    const value = source.reclaimed_bytes;
    if (typeof value === 'number' && Number.isFinite(value)) {
      return { reclaimed_bytes: value };
    }
  }
  return {};
}
