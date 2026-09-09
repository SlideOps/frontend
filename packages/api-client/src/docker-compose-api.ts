import { ApiError } from './errors';
import { apiRequest, unwrap } from './http';
import type { DockerContainer, DockerHealthcheck, DockerOwnership, DockerPort } from './docker';

/*
 * Compose stacks on one Node, the Compose file behind them, and creating a
 * container by hand.
 *
 * This is the write-heavy half of the Docker control centre, so the split that
 * governs docker.ts governs this file too: reads never change a Node, and every
 * call that does is reached only from a control the Operator pressed.
 *
 * Two calls here are singled out rather than folded into a generic verb, and
 * both for the same reason: they can lose data that does not come back.
 *
 * - `down` takes volumes with it when asked, and asking is a separate decision
 *   from bringing a stack down. So it is its own function with its own body
 *   type, not a seventh string passed to `runDockerComposeAction`.
 * - `applyDockerComposeFile` recreates containers and can drop volumes the new
 *   file no longer declares, so it carries the same explicit data-loss flag.
 *
 * A screen cannot reach either destructive path by passing a different string
 * to a call it was already making. That is deliberate.
 *
 * Field names mirror the backend contract exactly, snake_case included.
 */

/* ------------------------------------------------------------------ *
 * Compose projects
 * ------------------------------------------------------------------ */

/**
 * How much of a Compose stack is up.
 *
 * `partial` is the state worth naming: some services running and some not is
 * neither "running" nor "stopped", and collapsing it into either one hides the
 * single most common way a stack is broken. `unknown` is the honest answer when
 * the daemon reported containers the backend could not place into either camp.
 */
export type DockerComposeStatus = 'running' | 'partial' | 'stopped' | 'unknown';

/**
 * One Compose stack on the Node, as it appears in a list.
 *
 * `services` is names only. The list is a list; resolving every service to its
 * containers for a screen that shows a row per project would be a pass over the
 * daemon per project to render text nobody asked for yet. The detail read below
 * returns the resolved shape.
 *
 * `config_path` is absent when the daemon knows a project label but no file on
 * disk, which is ordinary for a stack brought up from a directory that has
 * since moved. A screen must say "not known" rather than inventing a path.
 */
/**
 * One service of a stack, assembled from the containers carrying its label.
 *
 * The counts are the point. A scaled service has several containers and one
 * state word hides that, so the number running is reported beside the number
 * there are. Docker's own state and health words are carried through unchanged.
 */
export interface DockerComposeServiceSummary {
  name: string;
  /** How many containers this service has. More than one when it is scaled. */
  containers: number;
  running: number;
  state: string;
  health?: string;
  image?: string;
  ports: DockerPort[];
}

/**
 * One Compose stack on the Node, whoever brought it up.
 *
 * The list and the detail answer with the same shape on purpose. They differ in
 * how much of it is filled in, not in what the fields mean, so a screen that
 * opens a project does not have to re-learn the type it was already showing.
 *
 * `config_files` is empty rather than absent when nothing on the Node records
 * where the stack was built from, which is ordinary for a project brought up
 * from a directory that has since moved. A screen says "not known" rather than
 * inventing a path.
 */
export interface DockerComposeProject {
  name: string;
  ownership: DockerOwnership;
  /** Compose's own summary, such as "running(3)". Carried through verbatim. */
  status?: string;
  config_files: string[];
  working_dir?: string;
  /** Whether SlideOps would read the first config file back to the Operator. */
  config_readable: boolean;
  containers: number;
  running: number;
  services: DockerComposeServiceSummary[];
  images: string[];
  networks: string[];
  volumes: string[];
  /** How the stack was found: compose itself, or the container labels. */
  found_by: string;
}

/**
 * Make a project safe to render.
 *
 * Same reasoning as the container lists: a nil slice from the server arrives as
 * null, and a component mapping over null stops rendering the page. Doing it
 * here means a screen can read every list without asking whether it is one.
 */
function safeProject(project: DockerComposeProject): DockerComposeProject {
  const list = <T>(value: T[] | null | undefined): T[] => (Array.isArray(value) ? value : []);
  return {
    ...project,
    config_files: list(project.config_files),
    images: list(project.images),
    networks: list(project.networks),
    volumes: list(project.volumes),
    services: list(project.services).map((service) => ({
      ...service,
      ports: list(service.ports),
    })),
  };
}

/** Every Compose stack on the Node, whoever brought it up. Reads only. */
export function listDockerComposeProjects(
  nodeId: string,
  signal?: AbortSignal,
): Promise<DockerComposeProject[]> {
  return apiRequest<unknown>(`/nodes/${encodeURIComponent(nodeId)}/docker/compose`, {
    signal,
  }).then((r) => (unwrap<DockerComposeProject[]>(r, 'projects') ?? []).map(safeProject));
}

/**
 * One stack in full: its services, their containers, and where its file lives.
 *
 * The project name is encoded rather than trusted. A Compose project name comes
 * from a directory an Operator chose, and a slash in one must not become a path
 * segment here.
 */
export function getDockerComposeProject(
  nodeId: string,
  project: string,
  signal?: AbortSignal,
): Promise<DockerComposeProject> {
  return apiRequest<unknown>(
    `/nodes/${encodeURIComponent(nodeId)}/docker/compose/${encodeURIComponent(project)}`,
    { signal },
  ).then((r) => safeProject(unwrap<DockerComposeProject>(r, 'project')));
}

/* ------------------------------------------------------------------ *
 * Acting on a stack
 * ------------------------------------------------------------------ */

/**
 * The stack actions that do not destroy anything.
 *
 * `down` is not among them and never will be. Every action here leaves the
 * stack's volumes and images where they are: a stopped stack starts again, a
 * pulled stack has newer images and the same data. `down` can be asked to take
 * the volumes with it, so it is a separate call below with a body that has to
 * be filled in on purpose.
 *
 * `rebuild` is in this list because rebuilding replaces images and recreates
 * containers, neither of which touches a named volume. It is disruptive, which
 * is a different thing from destructive, and the screen says so in its own copy.
 */
export type DockerComposeAction = 'up' | 'start' | 'stop' | 'restart' | 'pull' | 'rebuild';

/**
 * Run one non-destructive action against a stack.
 *
 * Resolves empty. The action changes several containers at once and the honest
 * post-state is whatever the daemon reports after it settles, not whatever the
 * response body happened to be captured at. The screen re-reads the stack, the
 * same way it re-reads the Node after removing a container.
 */
export function runDockerComposeAction(
  nodeId: string,
  project: string,
  action: DockerComposeAction,
): Promise<void> {
  return apiRequest<unknown>(
    `/nodes/${encodeURIComponent(nodeId)}/docker/compose/${encodeURIComponent(project)}/${action}`,
    { method: 'POST' },
  ).then(() => undefined);
}

/**
 * What bringing a stack down is allowed to take with it.
 *
 * Neither field has a default here, and neither should acquire one. `down` on
 * its own removes containers and networks, which Compose recreates from the
 * file; the volumes are the databases, the uploads, the things that are not in
 * the file and cannot be brought back by running `up` again.
 *
 * `confirm_data_loss` is a second, separate acknowledgement rather than a
 * synonym for the first. `remove_volumes` says what the Operator asked for;
 * `confirm_data_loss` says they were told what it costs and said yes anyway. A
 * client that sets the first without the second is refused, which is what makes
 * a mis-wired screen fail safely instead of quietly deleting a database.
 */
export interface DockerComposeDown {
  remove_volumes: boolean;
  confirm_data_loss: boolean;
}

/**
 * Bring a stack down.
 *
 * Separate from {@link runDockerComposeAction} on purpose: this is the one
 * stack action that can lose data, and it must not be reachable by passing a
 * different string to the call a screen was already making.
 */
export function downDockerComposeProject(
  nodeId: string,
  project: string,
  options: DockerComposeDown,
): Promise<void> {
  return apiRequest<unknown>(
    `/nodes/${encodeURIComponent(nodeId)}/docker/compose/${encodeURIComponent(project)}/down`,
    { method: 'POST', body: options },
  ).then(() => undefined);
}

/* ------------------------------------------------------------------ *
 * The Compose file
 * ------------------------------------------------------------------ */

/** A stack's Compose file as it stands on the Node, and where it was read from. */
export interface DockerComposeFile {
  content: string;
  path: string;
}

/**
 * One problem with a proposed Compose file.
 *
 * `line` is absent when the failure is about the document as a whole rather
 * than a place in it, such as a service naming a network nothing declares. A
 * screen must render those just as prominently: a problem with no line number
 * is not a smaller problem.
 */
export interface DockerComposeValidationError {
  line?: number;
  message: string;
}

/** Whether a proposed Compose file is usable, and what is wrong if it is not. */
export interface DockerComposeValidation {
  valid: boolean;
  errors: DockerComposeValidationError[];
}

/**
 * What applying a proposed file would change on the Node.
 *
 * `volumes_removed` is not one field among six. It is the only one here that
 * destroys something an Operator cannot get back by editing the file again: a
 * recreated container comes back, a changed image can be pulled again, a
 * removed network is redeclared. A removed volume is a deleted database.
 *
 * The presentation layer is required to treat it accordingly, which is why
 * `summariseComposeDiff` in the web app pulls it out of the group list rather
 * than trusting each screen to remember.
 */
export interface DockerComposeDiff {
  containers_recreated: string[];
  images_changed: string[];
  networks_added: string[];
  networks_removed: string[];
  volumes_added: string[];
  volumes_removed: string[];
}

/** Read the stack's Compose file. Reads only, and changes nothing. */
export function getDockerComposeFile(
  nodeId: string,
  project: string,
  signal?: AbortSignal,
): Promise<DockerComposeFile> {
  return apiRequest<DockerComposeFile>(
    `/nodes/${encodeURIComponent(nodeId)}/docker/compose/${encodeURIComponent(project)}/file`,
    { signal },
  );
}

/**
 * Ask the Node whether a proposed file is usable, without applying it.
 *
 * The content goes in the body and never in the query string. A Compose file
 * carries environment values, and a query string is logged by every proxy
 * between here and the Node.
 */
export function validateDockerComposeFile(
  nodeId: string,
  project: string,
  content: string,
): Promise<DockerComposeValidation> {
  return apiRequest<unknown>(
    `/nodes/${encodeURIComponent(nodeId)}/docker/compose/${encodeURIComponent(project)}/validate`,
    { method: 'POST', body: { content } },
  ).then((r) => unwrap<DockerComposeValidation>(r, 'validation'));
}

/** Ask the Node what applying a proposed file would change. Changes nothing. */
export function diffDockerComposeFile(
  nodeId: string,
  project: string,
  content: string,
): Promise<DockerComposeDiff> {
  return apiRequest<unknown>(
    `/nodes/${encodeURIComponent(nodeId)}/docker/compose/${encodeURIComponent(project)}/diff`,
    { method: 'POST', body: { content } },
  ).then((r) => unwrap<DockerComposeDiff>(r, 'diff'));
}

/**
 * Write the file and bring the stack to match it.
 *
 * `confirm_data_loss` is sent only when the diff the Operator was shown removed
 * a volume and they confirmed it. It is not a flag a screen sets to make an
 * error go away: sending it without having shown the diff would defeat the one
 * gate standing between an edit and a deleted database.
 */
export function applyDockerComposeFile(
  nodeId: string,
  project: string,
  input: { content: string; confirm_data_loss?: boolean },
): Promise<DockerComposeProject> {
  return apiRequest<unknown>(
    `/nodes/${encodeURIComponent(nodeId)}/docker/compose/${encodeURIComponent(project)}/apply`,
    { method: 'POST', body: input },
  ).then((r) => safeProject(unwrap<DockerComposeProject>(r, 'project')));
}

/* ------------------------------------------------------------------ *
 * Running a container by hand
 * ------------------------------------------------------------------ */

/** One port to publish. `host_port` absent leaves the port unpublished. */
export interface DockerRunPort {
  host_ip?: string;
  host_port?: number;
  container_port: number;
  protocol: string;
}

/**
 * One filesystem to attach.
 *
 * `source` is a named volume or a path on the Node; the backend decides which
 * it is, and refuses the paths that must not be handed to a container. This
 * client does not carry a `type` field, because letting a form declare "this
 * source is a volume, honestly" would be asking the client to classify the
 * thing the server is meant to be guarding.
 */
export interface DockerRunVolume {
  source: string;
  destination: string;
  read_only?: boolean;
}

/**
 * What the container is asked to do, with no field for privilege.
 *
 * There is deliberately no `privileged`, no `cap_add`, no `security_opt` and no
 * way to name the Docker socket as anything but an ordinary source the backend
 * will refuse. A container with the socket mounted is root on the Node with
 * extra steps, and SlideOps does not offer an Operator a one-click way to hand
 * that out from a form. The backend refuses it too; this type simply gives no
 * one anything to send.
 *
 * `healthcheck.test` is Docker's own array form, dispatch token included, which
 * is what {@link DockerHealthcheck} already reports on the way back. One shape
 * in both directions means a healthcheck read off a container can be sent
 * straight back when cloning it.
 */
export interface DockerRunRequest {
  image: string;
  name?: string;
  ports?: DockerRunPort[];
  env?: Record<string, string>;
  volumes?: DockerRunVolume[];
  restart_policy?: string;
  command?: string;
  entrypoint?: string;
  working_dir?: string;
  user?: string;
  cpu_limit_cores?: number;
  memory_limit_mb?: number;
  network?: string;
  dns?: string[];
  labels?: Record<string, string>;
  healthcheck?: DockerHealthcheck;
}

/**
 * Create and start one container.
 *
 * The whole request goes in the body. Nothing about it may move into the URL:
 * `env` holds database passwords and API keys, and a URL is written to every
 * access log on the way.
 */
export function createDockerContainer(
  nodeId: string,
  request: DockerRunRequest,
): Promise<DockerContainer> {
  return apiRequest<unknown>(`/nodes/${encodeURIComponent(nodeId)}/docker/containers`, {
    method: 'POST',
    body: request,
  }).then((r) => unwrap<DockerContainer>(r, 'container'));
}

/* ------------------------------------------------------------------ *
 * Refusals
 * ------------------------------------------------------------------ */

/**
 * The backend needs the Operator to confirm something before it will proceed,
 * usually a data-loss acknowledgement that was not sent.
 *
 * This arriving at all means a screen sent a destructive request without having
 * shown what it destroys. It is a bug in the client, and the right response on
 * screen is the explanation, not a retry with the flag set.
 */
export const CONFIRMATION_REQUIRED_CODE = 'confirmation_required';

/** A mount was refused: a path the Node will not hand out, or the Docker socket. */
export const FORBIDDEN_MOUNT_CODE = 'forbidden_mount';

/** Something in the request asked for privilege the backend will not grant. */
export const PRIVILEGED_REFUSED_CODE = 'privileged_refused';

function hasCode(error: unknown, code: string): boolean {
  return error instanceof ApiError && error.code === code;
}

/** Whether the backend is asking for an explicit confirmation it did not get. */
export function isConfirmationRequired(error: unknown): boolean {
  return hasCode(error, CONFIRMATION_REQUIRED_CODE);
}

/** Whether a mount in the request was refused. */
export function isForbiddenMount(error: unknown): boolean {
  return hasCode(error, FORBIDDEN_MOUNT_CODE);
}

/** Whether the request asked for privilege the backend refuses to grant. */
export function isPrivilegedRefused(error: unknown): boolean {
  return hasCode(error, PRIVILEGED_REFUSED_CODE);
}

/**
 * A plain-language explanation for a refusal, or null when this is not one.
 *
 * These three refusals are the ones an Operator is most likely to hit while
 * filling in a form, and all three are the product working as intended rather
 * than a fault. Rendering `forbidden_mount` as a red "request failed" would
 * teach exactly the wrong lesson: nothing broke, and trying again will not
 * help, because SlideOps will not mount that path however many times it is
 * asked.
 *
 * The backend's own message is preferred whenever it sent one, since it can
 * name the specific path or field. These sentences are the fallback for a bare
 * code, and they say what to do next rather than only what went wrong.
 */
export function refusalExplanation(error: unknown): string | null {
  if (!(error instanceof ApiError)) {
    return null;
  }
  const specific = error.message.trim();
  switch (error.code) {
    case FORBIDDEN_MOUNT_CODE:
      return (
        specific ||
        'That mount was refused. SlideOps will not attach the Docker socket or a system path to a container, because a container holding either one has full control of the server. Mount a named volume or a path under your own data directory instead.'
      );
    case PRIVILEGED_REFUSED_CODE:
      return (
        specific ||
        'That request asked for privileges SlideOps does not grant from this form. A privileged container is not isolated from the server it runs on. If a workload genuinely needs this, it belongs in a reviewed Capability rather than an ad hoc container.'
      );
    case CONFIRMATION_REQUIRED_CODE:
      return (
        specific ||
        'The server needs this confirmed before it will run it, and no confirmation was sent. Go back, read what the change removes, and confirm it there.'
      );
    default:
      return null;
  }
}

/** One declared dependency: `from` waits for `to`. */
export interface DockerComposeDependencyEdge {
  from: string;
  to: string;
  /** Compose's condition, such as service_healthy. Absent when plain. */
  condition?: string;
}

/**
 * What the stack file says starts before what.
 *
 * This is a declaration, not an observation: it is read from the Compose file
 * rather than from what is running, which is what an Operator staring at a
 * broken stack actually needs. It comes from its own endpoint because a running
 * container carries no record of the depends_on that started it.
 */
export interface DockerComposeGraph {
  services: string[];
  edges: DockerComposeDependencyEdge[];
  order: string[];
  /** A dependency loop, when the file declares one. Empty otherwise. */
  cycle: string[];
  /** Dependencies naming a service the file does not define. */
  missing: string[];
}

/** Read the dependency graph the stack file declares. */
export function getDockerComposeGraph(
  nodeId: string,
  project: string,
  signal?: AbortSignal,
): Promise<DockerComposeGraph> {
  return apiRequest<unknown>(
    `/nodes/${encodeURIComponent(nodeId)}/docker/compose/${encodeURIComponent(project)}/graph`,
    { signal },
  ).then((r) => {
    const graph = unwrap<DockerComposeGraph>(r, 'graph');
    const list = <T>(value: T[] | null | undefined): T[] => (Array.isArray(value) ? value : []);
    return {
      services: list(graph?.services),
      edges: list(graph?.edges),
      order: list(graph?.order),
      cycle: list(graph?.cycle),
      missing: list(graph?.missing),
    };
  });
}
