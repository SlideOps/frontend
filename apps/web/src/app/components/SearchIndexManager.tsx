import { Search } from '@slideops/icons';
import { ActionTable } from './ActionTable';

/** The indexes on a Meilisearch server, with their document count and primary key. */
export function SearchIndexManager({
  capabilityKey,
  nodeId,
  serviceId,
}: {
  capabilityKey: string;
  nodeId: string;
  serviceId?: string;
}) {
  return (
    <ActionTable
      capabilityKey={capabilityKey}
      actionKey="list-indexes"
      nodeId={nodeId}
      serviceId={serviceId}
      icon={Search}
      loadingLabel="Reading indexes"
      emptyTitle="No indexes yet"
      emptyDescription="Create an index to start searching, and it will show up here."
      searchPlaceholder="Search indexes..."
    />
  );
}

/** Whether SearchIndexManager knows how to draw this Capability. */
export function isSearchIndexCapability(capabilityKey: string): boolean {
  return capabilityKey === 'install-meilisearch';
}
