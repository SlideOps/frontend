import { listMarketplacePlugins, type Plugin } from '@slideops/api-client';

/**
 * One Capability an installed, non-Core Plugin provides, with the Plugin's own
 * name and category attached, for surfaces that want to show "what is
 * actually here" rather than the whole catalog. Core (secure SSH, the
 * firewall, the app user, packages) is deliberately excluded: it belongs to
 * the machine, not to an installed app, and has no browse UI or credentials
 * worth surfacing next to a database or a message broker's.
 */
export interface InstalledCapabilityRef {
  key: string;
  pluginId: string;
  pluginName: string;
  category: string;
}

/** The installed, non-Core Capabilities a Project actually has, flattened from its Plugins. */
export async function loadInstalledCapabilityRefs(
  projectId: string,
  signal?: AbortSignal,
): Promise<InstalledCapabilityRef[]> {
  const catalog: Plugin[] = await listMarketplacePlugins(projectId, signal);
  const refs: InstalledCapabilityRef[] = [];
  for (const plugin of catalog) {
    if (plugin.is_core || !plugin.installed) {
      continue;
    }
    for (const key of plugin.provides ?? []) {
      refs.push({ key, pluginId: plugin.id, pluginName: plugin.name, category: plugin.category });
    }
  }
  return refs;
}
