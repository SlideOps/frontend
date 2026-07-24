import { apiRequest, unwrap } from './http';
import type { CapabilityParameter } from './types';

/*
 * The Marketplace surface. A Plugin is a first-party bundle of Capabilities and
 * Providers described by a manifest. The Core bundle ships pre-installed and can
 * never be uninstalled; every other Plugin is installed per Operator to unlock
 * its Capabilities. Like the rest of the client, every call is same origin,
 * sends the session cookie, and unwraps the backend envelope tolerantly.
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
 * A Plugin the Operator has installed. Secret config values are redacted in the
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
  manifest: PluginManifest;
  core?: boolean;
  installed?: boolean;
  enabled?: boolean;
}

/** Flatten a catalog entry into the flat Plugin the screens read. */
function toPlugin(raw: CatalogEntry): Plugin {
  return { ...raw.manifest, installed: Boolean(raw.installed), is_core: Boolean(raw.core) };
}

export function listMarketplacePlugins(signal?: AbortSignal): Promise<Plugin[]> {
  return apiRequest<unknown>('/marketplace/plugins', { signal })
    .then((r) => unwrap<CatalogEntry[]>(r, 'plugins'))
    .then((list) => list.map(toPlugin));
}

/** Read one Marketplace Plugin by its id. */
export function getMarketplacePlugin(id: string, signal?: AbortSignal): Promise<Plugin> {
  return apiRequest<unknown>(`/marketplace/plugins/${id}`, { signal })
    .then((r) => unwrap<CatalogEntry>(r, 'plugin'))
    .then(toPlugin);
}

/** List the Operator's installed Plugins, with config redacted. */
export function listInstalledPlugins(signal?: AbortSignal): Promise<InstalledPlugin[]> {
  return apiRequest<unknown>('/plugins', { signal }).then((r) =>
    unwrap<InstalledPlugin[]>(r, 'plugins'),
  );
}

/** Install a Plugin for the Operator, optionally with its configuration. */
export function installPlugin(input: InstallPluginInput): Promise<InstalledPlugin> {
  return apiRequest<unknown>('/plugins', { method: 'POST', body: input }).then((r) =>
    unwrap<InstalledPlugin>(r, 'plugin'),
  );
}

/**
 * Reconfigure an installed Plugin or enable and disable it. The Plugin is
 * addressed by its plugin id, which uniquely identifies the Operator's install.
 */
export function updatePlugin(pluginId: string, input: UpdatePluginInput): Promise<InstalledPlugin> {
  return apiRequest<unknown>(`/plugins/${pluginId}`, { method: 'PATCH', body: input }).then((r) =>
    unwrap<InstalledPlugin>(r, 'plugin'),
  );
}

/** Uninstall a Plugin. The Core bundle cannot be uninstalled. */
export function uninstallPlugin(pluginId: string): Promise<void> {
  return apiRequest<void>(`/plugins/${pluginId}`, { method: 'DELETE' });
}
