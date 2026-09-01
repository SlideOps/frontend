import { DatabaseExplorer, isExplorableDatabase } from './DatabaseExplorer';
import { WebSitesManager, isWebSitesCapability } from './WebSitesManager';
import { MessagingManager, isMessagingCapability } from './MessagingManager';
import { StorageExplorer, isStorageCapability } from './StorageExplorer';
import { SearchIndexManager, isSearchIndexCapability } from './SearchIndexManager';
import { RuntimeManager, isRuntimeCapability } from './RuntimeManager';
import { NetworkingManager, isNetworkingCapability } from './NetworkingManager';

/*
 * Where a Capability key meets its own visual manager, in one place, so
 * anywhere that wants to say "does this have a real UI, and if so which
 * component draws it" asks once rather than repeating the same chain of
 * isXCapability checks. CapabilityDetail.tsx still wires these in one at a
 * time, since it also needs its own Section title and gating per category;
 * this exists for surfaces that just want "whatever this installed
 * Capability's manager is, draw it here", such as a Service's Browse tab
 * showing every installed app that has one.
 */

/** Whether capabilityKey has a real visual manager at all. */
export function hasVisualManager(capabilityKey: string): boolean {
  return (
    isExplorableDatabase(capabilityKey) ||
    isWebSitesCapability(capabilityKey) ||
    isMessagingCapability(capabilityKey) ||
    isStorageCapability(capabilityKey) ||
    isSearchIndexCapability(capabilityKey) ||
    isRuntimeCapability(capabilityKey) ||
    isNetworkingCapability(capabilityKey)
  );
}

/**
 * The visual manager for one installed Capability, whichever one it is.
 * Renders nothing when the Capability has none (check hasVisualManager first
 * to decide whether to show it at all).
 *
 * serviceId is only ever passed through to DatabaseExplorer: the backend's
 * Service scoping (narrowing a read to what one Service actually uses) is
 * built around database rows, keyed on their first column being a database
 * name. Every other category's rows mean something else in that column, so
 * passing serviceId through to them would silently narrow their results to
 * nothing rather than actually scope anything.
 */
export function CapabilityManagerFor({
  capabilityKey,
  nodeId,
  serviceId,
}: {
  capabilityKey: string;
  nodeId: string;
  serviceId?: string;
}) {
  if (isExplorableDatabase(capabilityKey)) {
    return <DatabaseExplorer capabilityKey={capabilityKey} nodeId={nodeId} serviceId={serviceId} />;
  }
  if (isWebSitesCapability(capabilityKey)) {
    return <WebSitesManager capabilityKey={capabilityKey} nodeId={nodeId} />;
  }
  if (isMessagingCapability(capabilityKey)) {
    return <MessagingManager capabilityKey={capabilityKey} nodeId={nodeId} />;
  }
  if (isStorageCapability(capabilityKey)) {
    return <StorageExplorer capabilityKey={capabilityKey} nodeId={nodeId} />;
  }
  if (isSearchIndexCapability(capabilityKey)) {
    return <SearchIndexManager capabilityKey={capabilityKey} nodeId={nodeId} />;
  }
  if (isRuntimeCapability(capabilityKey)) {
    return <RuntimeManager capabilityKey={capabilityKey} nodeId={nodeId} />;
  }
  if (isNetworkingCapability(capabilityKey)) {
    return <NetworkingManager capabilityKey={capabilityKey} nodeId={nodeId} />;
  }
  return null;
}
