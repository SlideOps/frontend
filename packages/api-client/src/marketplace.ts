import { apiRequest, unwrap } from './http';
import type { CapabilityParameter } from './types';

/*
 * The Marketplace surface. A Plugin is a first-party bundle of Capabilities and
 * Providers described by a manifest. The Core bundle ships pre-installed and can
 * never be uninstalled; every other Plugin is installed per Project to unlock
 * its Capabilities there. The catalog stays global, so browsing it needs no
 * Project; passing one reflects that Project's installed and enabled flags.
 * Like the rest of the client, every call is same origin, sends the session
 * cookie, and unwraps the backend envelope tolerantly.
 */

/**
 * One input a Plugin needs before it can run, described in metadata so the
 * frontend generates the config form. It carries the same shape as a Capability
 * parameter, so the same generated form and Zod schema render both.
 */
export type PluginConfigParameter = CapabilityParameter;

/**
 * A Plugin manifest: what the bundle is, who authored it, the Capabilities it
 * provides, the config it needs, and the permissions it asks for.
 */
export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  author: string;
  category: string;
  description: string;
  /** The Capability keys this Plugin adds when installed. */
  provides: string[];
  /** The inputs the Plugin needs to be configured. Empty when it needs none. */
  config: PluginConfigParameter[];
  /** The permissions the Plugin asks for, in plain language. */
  permissions: string[];
}

/**
 * A Marketplace catalog entry: the manifest plus whether the current Operator
 * has installed it. The Core bundle reports `is_core` so the UI shows it as
 * built in and never offers to uninstall it.
 */
export interface Plugin extends PluginManifest {
  installed: boolean;
  is_core?: boolean;
}

/**
 * A Plugin installed in a Project. Secret config values are redacted in the
 * response. The manifest is embedded when the backend includes it so the list
 * renders without a second lookup.
 */
export interface InstalledPlugin {
  id: string;
  plugin_id: string;
  enabled: boolean;
  /** The stored configuration, with any secret values redacted. */
  config?: Record<string, unknown>;
  installed_at: string;
  updated_at?: string;
  is_core?: boolean;
  manifest?: PluginManifest;
}

/**
 * The manifest exactly as the backend sends it over the wire: the Capability
 * keys a Plugin adds are named `capabilities` there (see
 * pluginManifestView in the backend), not `provides`. Every screen in this
 * app reads `provides`, so toManifest below is the one place that name is
 * translated; nothing else should read raw JSON for a manifest directly.
 */
interface RawPluginManifest extends Omit<PluginManifest, 'provides'> {
  capabilities: string[];
}

function toManifest(raw: RawPluginManifest): PluginManifest {
  const { capabilities, ...rest } = raw;
  return { ...rest, provides: capabilities ?? [] };
}

/** The values supplied when installing a Plugin. */
export interface InstallPluginInput {
  plugin_id: string;
  config?: Record<string, unknown>;
}

/** The values supplied when reconfiguring or enabling a Plugin. */
export interface UpdatePluginInput {
  config?: Record<string, unknown>;
  enabled?: boolean;
}

/** The Marketplace catalog: every available Plugin, each with an installed flag. */
/**
 * The wire shape of a catalog entry: the manifest plus the Operator-specific
 * state. We flatten it into a Plugin so screens read a single flat object.
 */
interface CatalogEntry {
  manifest: RawPluginManifest;
  core?: boolean;
  installed?: boolean;
  enabled?: boolean;
}

/** Flatten a catalog entry into the flat Plugin the screens read. */
function toPlugin(raw: CatalogEntry): Plugin {
  return { ...toManifest(raw.manifest), installed: Boolean(raw.installed), is_core: Boolean(raw.core) };
}

/**
 * List the global Marketplace catalog. Passing a Project id reflects that
 * Project's installed and enabled flags; with no Project only the Core bundle
 * reads as installed, which is what the browse-only global screen relies on.
 */
export function listMarketplacePlugins(
  projectId?: string,
  signal?: AbortSignal,
): Promise<Plugin[]> {
  return apiRequest<unknown>('/marketplace/plugins', { query: { project_id: projectId }, signal })
    .then((r) => unwrap<CatalogEntry[]>(r, 'plugins'))
    .then((list) => list.map(toPlugin));
}

/**
 * Read one Marketplace Plugin by its id. Passing a Project id reflects that
 * Project's installed and enabled flags, as the list does.
 */
export function getMarketplacePlugin(
  id: string,
  projectId?: string,
  signal?: AbortSignal,
): Promise<Plugin> {
  return apiRequest<unknown>(`/marketplace/plugins/${id}`, {
    query: { project_id: projectId },
    signal,
  })
    .then((r) => unwrap<CatalogEntry>(r, 'plugin'))
    .then(toPlugin);
}

/** The wire shape of an installed Plugin: its embedded manifest, if any, is raw. */
interface RawInstalledPlugin extends Omit<InstalledPlugin, 'manifest'> {
  manifest?: RawPluginManifest;
}

/** List a Project's installed Plugins, with config redacted. */
export function listInstalledPlugins(
  projectId: string,
  signal?: AbortSignal,
): Promise<InstalledPlugin[]> {
  return apiRequest<unknown>(`/projects/${projectId}/plugins`, { signal })
    .then((r) => unwrap<RawInstalledPlugin[]>(r, 'plugins'))
    .then((list) => list.map((p) => ({ ...p, manifest: p.manifest ? toManifest(p.manifest) : undefined })));
}

/** Install a Plugin into a Project, optionally with its configuration. */
function toInstalledPlugin(raw: RawInstalledPlugin): InstalledPlugin {
  return { ...raw, manifest: raw.manifest ? toManifest(raw.manifest) : undefined };
}

export function installPlugin(
  projectId: string,
  input: InstallPluginInput,
): Promise<InstalledPlugin> {
  return apiRequest<unknown>(`/projects/${projectId}/plugins`, {
    method: 'POST',
    body: input,
  })
    .then((r) => unwrap<RawInstalledPlugin>(r, 'plugin'))
    .then(toInstalledPlugin);
}

/**
 * Reconfigure a Project's installed Plugin or enable and disable it. The Plugin
 * is addressed by its plugin id, which uniquely identifies the install.
 */
export function updatePlugin(
  projectId: string,
  pluginId: string,
  input: UpdatePluginInput,
): Promise<InstalledPlugin> {
  return apiRequest<unknown>(`/projects/${projectId}/plugins/${pluginId}`, {
    method: 'PATCH',
    body: input,
  })
    .then((r) => unwrap<RawInstalledPlugin>(r, 'plugin'))
    .then(toInstalledPlugin);
}

/** Uninstall a Plugin from a Project. The Core bundle cannot be uninstalled. */
export function uninstallPlugin(projectId: string, pluginId: string): Promise<void> {
  return apiRequest<void>(`/projects/${projectId}/plugins/${pluginId}`, { method: 'DELETE' });
}
