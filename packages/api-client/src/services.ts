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
 * software is an application an Operator deploys and runs; capability is
 * infrastructure a Project depends on (a database, a cache), deployed
 * through deployCapabilities rather than deployService.
 */
export type ServiceDeploymentType = 'software' | 'capability';

/**
 * Where a Service's workload comes from. An image source runs a prebuilt image;
 * a repository source clones the repository and builds it first. `command` is
 * the entrypoint for a systemd unit or an override for a container.
 */
export interface ServiceSource {
  /**
   * `adopted` marks a workload that was already running when SlideOps found it,
   * so there is no image or repository to rebuild it from; the image, where the
   * runtime reports one, is kept for display only. `capability` marks a
   * Capability Service: there is nothing here to build either, for the
   * opposite reason -- what is running is several independently tracked
   * Capabilities, not one workload this shape could describe.
   */
  type: 'image' | 'repository' | 'adopted' | 'capability';
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
  /** software or capability. */
  deployment_type: ServiceDeploymentType;
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
  /** This Service's automatic deployment configuration. Off by default. */
  cicd: ServiceCICD;
  /**
   * What a Capability Service tracks: which engines compose it, and how
   * each is doing. Undefined for a software Service, which tracks none.
   */
  capabilities?: ServiceCapability[];
}

/** How one Capability a Capability Service tracks is doing. */
export type ServiceCapabilityStatus = 'running' | 'done' | 'failed';

/** One Capability tracked as part of a Capability Service. */
export interface ServiceCapability {
  capability_key: string;
  operation_id: string;
  status: ServiceCapabilityStatus;
  created_at: string;
}

/** Where a BuildModeExternal Service's running image actually comes from. */
export type ServiceBuildMode = 'slideops' | 'external';

/**
 * A Service's automatic deployment settings, as read back. Never carries a
 * secret plaintext: `*_configured` says whether one is stored, not what it is.
 */
export interface ServiceCICD {
  auto_deploy: boolean;
  build_mode: ServiceBuildMode;
  /**
   * Whether a GitHub push webhook was successfully registered. False with
   * auto_deploy true means the polling fallback is what is actually running
   * it; the CI/CD tab explains why.
   */
  webhook_configured: boolean;
  /**
   * Whether a deploy hook token has been rotated at least once. The token
   * itself is only ever returned once, at the moment it is rotated.
   */
  deploy_hook_configured: boolean;
  registry_url?: string;
  registry_username?: string;
  registry_configured: boolean;
  /** The image the most recent deploy hook call or artifact upload deployed. */
  last_external_image?: string;
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

/** One Capability to install as part of a Capability Service. */
export interface CapabilitySelectionInput {
  capability_key: string;
  parameters?: Record<string, unknown>;
}

/** The fields required to deploy a Capability Service. */
export interface DeployCapabilitiesInput {
  name: string;
  project_id: string;
  node_id: string;
  capabilities: CapabilitySelectionInput[];
}

/**
 * Deploy a Capability Service: several infrastructure Capabilities put in
 * place together as one named Service a Project depends on, instead of one
 * unrelated Service per engine.
 *
 * Each Capability still runs as its own real Operation -- planned, approved,
 * executed, verified, recorded in History -- exactly as starting it on its
 * own would. They do not depend on each other, so one failing does not stop
 * the rest: the Service ends up running with whichever succeeded, and
 * `last_error` names whichever did not.
 *
 * Returns immediately with the Service at `deploying`. Watch it complete with
 * getService or the realtime stream.
 */
export function deployCapabilities(input: DeployCapabilitiesInput): Promise<Service> {
  return apiRequest<unknown>('/services/capabilities', { method: 'POST', body: input }).then((r) =>
    unwrap<Service>(r, 'service'),
  );
}

/**
 * Add one more Capability to an existing Capability Service, run the same
 * way the initial deploy ran each one. Refused for a software Service, and
 * refused for a Capability the Service already tracks -- reconfiguring an
 * existing one is that Capability's own Configure action, not this one.
 */
export function addServiceCapability(
  serviceId: string,
  selection: CapabilitySelectionInput,
): Promise<Service> {
  return apiRequest<unknown>(`/services/${serviceId}/capabilities`, {
    method: 'POST',
    body: selection,
  }).then((r) => unwrap<Service>(r, 'service'));
}

/** What a Capability Service currently tracks. */
export function listServiceCapabilities(
  serviceId: string,
  signal?: AbortSignal,
): Promise<ServiceCapability[]> {
  return apiRequest<unknown>(`/services/${serviceId}/capabilities`, { signal }).then((r) =>
    unwrap<ServiceCapability[]>(r, 'capabilities'),
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

/**
 * Stop and remove a Service's workload, freeing its allocation. The Service
 * stays on record, so it can still be seen and never be redeployed.
 *
 * For a Capability Service, every Capability that finished installing is
 * uninstalled from the Node through its own remove Capability (unless
 * another Service on the same Node still depends on it, in which case that
 * one is left in place). dropData forwards that Capability's own
 * destructive drop-data choice; left false, its data directory is kept.
 */
export function removeService(id: string, dropData = false): Promise<void> {
  return apiRequest<void>(`/services/${id}`, { method: 'DELETE', body: { drop_data: dropData } });
}

/**
 * Permanently delete a Service: its record, its activity trail, and any
 * secret it holds for an environment variable, all gone for good. Unlike
 * removeService, there is no coming back from this.
 *
 * Refused with confirmation_mismatch unless confirm is exactly
 * `"delete " + the Service's own name`, read back from what the Operator
 * typed rather than a checkbox, since this cannot be undone.
 *
 * dropData is the same Capability Service drop-data choice removeService
 * takes.
 */
export function purgeService(id: string, confirm: string, dropData = false): Promise<void> {
  return apiRequest<void>(`/services/${id}/purge`, {
    method: 'DELETE',
    body: { confirm, drop_data: dropData },
  });
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
 * What the CI/CD tab's settings form edits together.
 *
 * `registry_password` follows the same convention a secret env value does:
 * omit it to leave a stored credential untouched, since a sealed value cannot
 * be read back into the form to show unchanged; send an empty string to
 * clear it; send anything else to replace it.
 */
export interface UpdateServiceCICDInput {
  auto_deploy: boolean;
  build_mode: ServiceBuildMode;
  registry_url: string;
  registry_username: string;
  registry_password?: string;
}

/**
 * Update a Service's automatic deployment settings. Turning auto-deploy on in
 * slideops mode for a repository this platform can reach on GitHub tries to
 * register a push webhook; if that fails, auto-deploy is still turned on,
 * backed by the polling fallback, and why is on `listServiceDeployEvents`.
 */
export function updateServiceCICD(id: string, input: UpdateServiceCICDInput): Promise<Service> {
  return apiRequest<unknown>(`/services/${encodeURIComponent(id)}/cicd`, {
    method: 'PUT',
    body: input,
  }).then((r) => unwrap<Service>(r, 'service'));
}

/** A newly rotated deploy hook token, and the Service it belongs to. */
export interface DeployHookToken {
  service: Service;
  /** The plaintext bearer token, shown exactly once. It cannot be read back
   *  after this call; rotate again to replace it. */
  token: string;
}

/**
 * Rotate a Service's deploy hook token, replacing any existing one. Put the
 * returned token wherever an external CI's deploy hook or artifact upload
 * call authenticates from; it is never shown again after this call returns.
 */
export function rotateDeployHookToken(id: string): Promise<DeployHookToken> {
  return apiRequest<DeployHookToken>(
    `/services/${encodeURIComponent(id)}/cicd/deploy-hook/rotate`,
    {
      method: 'POST',
    },
  );
}

/** What caused a deploy attempt to run, for the CI/CD activity trail. */
export type DeployEventTrigger =
  'push_webhook' | 'poll' | 'deploy_hook' | 'artifact_upload' | 'manual';

/** What happened once that trigger fired. */
export type DeployEventOutcome = 'redeploy_started' | 'skipped' | 'error';

/** One entry in a Service's CI/CD activity trail. */
export interface DeployEvent {
  id: string;
  trigger: DeployEventTrigger;
  commit_sha?: string;
  image?: string;
  outcome: DeployEventOutcome;
  detail?: string;
  created_at: string;
}

/**
 * A Service's CI/CD activity trail, newest first: what triggered a deploy
 * attempt and what happened. This is what explains a skipped or failed
 * automatic deploy once a webhook, not a click, is what starts one.
 */
export function listServiceDeployEvents(
  id: string,
  limit?: number,
  signal?: AbortSignal,
): Promise<DeployEvent[]> {
  return apiRequest<unknown>(`/services/${encodeURIComponent(id)}/cicd/deploy-events`, {
    query: { limit },
    signal,
  }).then((r) => unwrap<DeployEvent[]>(r, 'events'));
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
 * An edit to where a Service is pulled or built from. Send the whole source, not
 * a patch: switching `type` is how a Service moves between an image and a
 * repository, and the fields belonging to the type being left behind are cleared
 * by the backend so a Service never describes two origins at once.
 *
 * `adopted` and `capability` are not editable source types. Neither was built by
 * SlideOps, so neither can be rebuilt from a different source.
 */
export interface ServiceSourceEdit {
  type: 'image' | 'repository';
  image?: string;
  repository_url?: string;
  branch?: string;
  build?: string;
}

/**
 * Edit a deployed Service's source, published ports, command and environment
 * variables.
 *
 * `env` **replaces** rather than merges, so send the complete set you want:
 * leaving one out is how it is removed, and a previously sealed secret you do not
 * resend is dropped for the same reason. `ports` replaces in the same way, so
 * sending `[]` publishes nothing.
 *
 * `source` and `ports` are **optional, and omitting them leaves them unchanged**.
 * That is deliberately different from sending an empty value: a caller editing
 * only an env var must not have to resend the source to avoid clearing it.
 *
 * The change is saved but **not yet live**: a container bakes all of this in when
 * it is created, so `redeployService` is what applies it. The returned Service
 * carries `config_changed_at` so a screen can say so.
 *
 * An adopted Service refuses a source or port edit with `adopted_not_buildable`:
 * SlideOps never built it, so it cannot rebuild it either.
 */
export function updateServiceConfiguration(
  id: string,
  configuration: {
    command: string;
    env: ServiceEnvVar[];
    source?: ServiceSourceEdit;
    ports?: ServicePort[];
  },
): Promise<Service> {
  return apiRequest<unknown>(`/services/${encodeURIComponent(id)}/configuration`, {
    method: 'PATCH',
    body: configuration,
  }).then((r) => unwrap<Service>(r, 'service'));
}

/**
 * An edit to one environment variable. The variable being edited is named in the
 * request path under the name it carries *now*, so that path is the identity of
 * the edit and this body carries only what changes about it.
 */
export interface ServiceEnvVarEdit {
  /**
   * The name to give the variable. Omitted, or equal to the name in the path,
   * leaves the name alone.
   */
  name?: string;
  /** The new value. Ignored when `keep_value` is set. */
  value: string;
  /** Seal the value in the secret store. Ignored when `keep_value` is set. */
  secret: boolean;
  /**
   * Rename without touching the stored value.
   *
   * This is the only way to rename a sealed variable. Its plaintext is not
   * readable, so there is nothing to resend, and echoing the redaction marker
   * back would store those words as the variable's value.
   */
  keep_value?: boolean;
  /**
   * The `config_changed_at` read when the editor was opened, echoed back verbatim.
   * The save is refused when the configuration moved since then.
   *
   * Worth sending on every edit, because a save writes the whole environment: a
   * stale one does not merely lose the field in hand, it reinstates every other
   * variable as the stale copy remembered them.
   */
  if_unchanged_since?: string;
}

/**
 * Edit one environment variable on a deployed Service -- its value, its name, or
 * both -- leaving every other variable exactly as it is.
 *
 * This exists because {@link updateServiceConfiguration} replaces the whole set.
 * Correcting a single mistyped variable through that route means the caller
 * reassembles every other one first, and a value it cannot read back (a sealed
 * secret) is one it cannot resend, so the safe edit was the expensive one. Here
 * the wire carries only the variable being changed, so nothing else can be lost
 * by omission.
 *
 * `key` is the variable's name as it stands right now; `edit.name` is what to
 * rename it to.
 *
 * The change is saved but **not yet live**: a container bakes its environment in
 * when it is created, so `redeployService` is what applies it. The returned
 * Service carries `config_changed_at` so a screen can say so.
 */
export function updateServiceEnvVar(
  serviceId: string,
  key: string,
  edit: ServiceEnvVarEdit,
): Promise<Service> {
  return apiRequest<unknown>(
    `/services/${encodeURIComponent(serviceId)}/environment/${encodeURIComponent(key)}`,
    { method: 'PATCH', body: edit },
  ).then((r) => unwrap<Service>(r, 'service'));
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

/** One thing that happened to a Service. */
export interface ServiceActivity {
  id: string;
  /** A stable identifier, so a client can group without parsing the message. */
  kind: string;
  /** Already in the Operator's language, written when it happened. */
  message: string;
  outcome: 'ok' | 'failed' | 'pending';
  /**
   * Context beside the message: the commit a deploy built, the variable names an
   * edit moved. Never a value out of an environment.
   */
  detail: Record<string, unknown>;
  created_at: string;
}

/**
 * A Service's own trail, newest first.
 *
 * Not History, which records Operations against a server, and not the audit
 * trail, which stays scoped to security relevant acts. This is what happened to
 * one application: what deployed and from which commit, what stopped it, what
 * changed its configuration just before it broke.
 */
export function getServiceActivity(
  id: string,
  limit = 100,
  signal?: AbortSignal,
): Promise<ServiceActivity[]> {
  return apiRequest<unknown>(
    `/services/${encodeURIComponent(id)}/activity?limit=${encodeURIComponent(String(limit))}`,
    { signal },
  ).then((r) => unwrap<ServiceActivity[]>(r, 'activity'));
}

/**
 * The Capability instance to connect: a specific completed Operation, not
 * "the Capability" in the abstract -- the same Operation its own credential
 * card already points at, so Connect always wires in the exact credential
 * shown. `env_prefix` is optional; leaving it out picks a sensible default
 * from the Capability's own family (DATABASE for Postgres/MySQL/MariaDB/
 * MongoDB, REDIS for Redis).
 */
export interface ConnectCapabilityInput {
  node_id: string;
  capability_key: string;
  operation_id: string;
  env_prefix?: string;
}

/**
 * Wire a Capability's connection details into a Service's environment --
 * host, port, database, username, its password when it has one, and a ready
 * to use URL -- keeping every variable already there, and redeploy so it
 * applies immediately. One call, not a config edit followed by a separate
 * redeploy.
 */
export function connectCapability(
  serviceId: string,
  input: ConnectCapabilityInput,
): Promise<Service> {
  return apiRequest<unknown>(`/services/${encodeURIComponent(serviceId)}/connect`, {
    method: 'POST',
    body: input,
  }).then((r) => unwrap<Service>(r, 'service'));
}

/** One recorded Connect action. */
export interface ServiceConnection {
  id: string;
  service_id: string;
  source_node_id: string;
  source_capability_key: string;
  source_operation_id: string;
  env_prefix: string;
  created_at: string;
}

/** What a Service is connected to. */
export function getServiceConnections(
  serviceId: string,
  signal?: AbortSignal,
): Promise<ServiceConnection[]> {
  return apiRequest<unknown>(`/services/${encodeURIComponent(serviceId)}/connections`, {
    signal,
  }).then((r) => unwrap<ServiceConnection[]>(r, 'connections'));
}

/**
 * What's using a Capability: every Service connected to it on this Node.
 * This doubles as the plain "what talks to what" list -- not a diagram,
 * just names.
 */
export function getCapabilityConnections(
  nodeId: string,
  capabilityKey: string,
  signal?: AbortSignal,
): Promise<ServiceConnection[]> {
  return apiRequest<unknown>(
    `/nodes/${encodeURIComponent(nodeId)}/capabilities/${encodeURIComponent(capabilityKey)}/connections`,
    { signal },
  ).then((r) => unwrap<ServiceConnection[]>(r, 'connections'));
}

/**
 * One rule protecting a database: what is currently allowed to reach it, and
 * whether SlideOps configured it. Read from SlideOps' own record rather than
 * derived live over SSH, so it still answers when the Node is briefly
 * unreachable.
 */
export interface DatabaseAccessRule {
  id: string;
  source_kind: 'node' | 'cidr';
  source_node_id?: string;
  source_cidr: string;
  topology: 'same_node' | 'cross_node';
  firewall_backend: string;
  to_port: number;
  protocol: string;
  db_side_change: string;
  state: 'planned' | 'applied' | 'detected' | 'removed' | 'failed';
  created_at: string;
}

/** What currently protects a database Capability on this Node. */
export function getDatabaseAccessRules(
  nodeId: string,
  capabilityKey: string,
  signal?: AbortSignal,
): Promise<DatabaseAccessRule[]> {
  return apiRequest<unknown>(
    `/nodes/${encodeURIComponent(nodeId)}/capabilities/${encodeURIComponent(capabilityKey)}/access-rules`,
    { signal },
  ).then((r) => unwrap<DatabaseAccessRule[]>(r, 'rules'));
}

/** How a single Preflight check came out. */
export type PreflightStatus = 'pass' | 'warn' | 'fail';

/**
 * What kind of fix a Remedy is.
 *
 * `run_capability` runs a Capability on a Node through the ordinary Operation
 * lifecycle -- planned, approved, executed, verified, recorded in History.
 * `rewrite_env` corrects one of the Service's own environment variables, which
 * needs no Node access at all.
 */
export type RemedyAction = 'run_capability' | 'rewrite_env';

/**
 * The fix for a failing check.
 *
 * A check that explains an outage and then leaves the Operator to fix it in a
 * terminal has moved the work, not done it. This is what turns a red row into
 * a button: it is sent back to applyRemedy exactly as it arrived, so nothing
 * here has to understand what a Capability is.
 */
export interface Remedy {
  action: RemedyAction;
  /** What applying this will do, in one line. Use it as the button label. */
  title: string;
  /** Why this is the right fix for what was observed. */
  detail: string;
  /** Set for run_capability: the Capability, the Node it runs on, its inputs. */
  capability_key?: string;
  node_id?: string;
  node_name?: string;
  parameters?: Record<string, string>;
  /** Set for rewrite_env: the variable to correct and its correct value. */
  env_key?: string;
  env_value?: string;
}

/** One thing Preflight or Diagnose looked at, and how to fix it. */
export interface PreflightCheck {
  name: string;
  status: PreflightStatus;
  message: string;
  /** Absent when the check passed, or when no fix SlideOps can run would help. */
  remedy?: Remedy;
}

/**
 * Check a deploy before running it: the Node answers, the chosen runtime's
 * own tool is present, every manually chosen port is actually free, and a
 * rough read of whether the Node currently has the CPU and memory
 * requested. Read only -- nothing about the Node changes, and nothing here
 * blocks an actual deploy; every check is advisory.
 */
export function preflightDeploy(input: DeployServiceInput): Promise<PreflightCheck[]> {
  return apiRequest<unknown>('/services/preflight', { method: 'POST', body: input }).then((r) =>
    unwrap<PreflightCheck[]>(r, 'checks'),
  );
}

/**
 * Find out why a Service that already deployed is not working.
 *
 * Preflight answers "would this deploy". This answers "why has this stopped",
 * which is a different question with different causes: a container that is
 * crash-looping (reported with its own last output), a dependency that is no
 * longer reachable from its Node, or a hostname with nothing listening to
 * answer it. Read only -- it never changes the Node.
 */
export function diagnoseService(serviceId: string, signal?: AbortSignal): Promise<PreflightCheck[]> {
  return apiRequest<unknown>(`/services/${encodeURIComponent(serviceId)}/diagnose`, {
    method: 'POST',
    signal,
  }).then((r) => unwrap<PreflightCheck[]>(r, 'checks'));
}

/**
 * Apply the fix a check offered, and return the Operation to follow.
 *
 * A fix that runs a Capability returns its `operation_id`; one that only
 * corrects the Service's own configuration needs no Operation and returns an
 * empty string. Send the Remedy back exactly as the check handed it out.
 */
export function applyRemedy(serviceId: string, remedy: Remedy): Promise<string> {
  return apiRequest<{ operation_id?: string }>(
    `/services/${encodeURIComponent(serviceId)}/remedy`,
    { method: 'POST', body: { remedy } },
  ).then((r) => r.operation_id ?? '');
}

/**
 * Apply a fix a Preflight offered, before the Service exists.
 *
 * A firewall dropping the traffic is worth fixing when the check finds it, not
 * after a deploy proves it again. Only Capability fixes can be applied this
 * way: one that rewrites a Service's own configuration has no Service to
 * rewrite yet, and is refused.
 */
export function applyPreflightRemedy(remedy: Remedy, projectId: string): Promise<string> {
  return apiRequest<{ operation_id?: string }>('/services/remedy', {
    method: 'POST',
    body: { remedy, project_id: projectId },
  }).then((r) => r.operation_id ?? '');
}
