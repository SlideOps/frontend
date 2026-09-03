import { ApiError, getCapabilityStates, type CapabilityState } from '@slideops/api-client';
import { Text } from '@slideops/design-system';
import { Boxes } from '@slideops/icons';
import { EmptyState } from '@slideops/ui';
import { useEffect, useState } from 'react';
import { CapabilityManagerFor, hasVisualManager } from './CapabilityManagers';
import { CapabilityManagement } from './CapabilityManagement';
import { loadInstalledCapabilityRefs, type InstalledCapabilityRef } from '../installed-capabilities';
import { DATABASE_EXPLORER_ACTION_KEYS, isExplorableDatabase } from './DatabaseExplorer';
import { ErrorNote, Loading } from './Feedback';

/**
 * Every installed app this Service's Project actually has, that also has a
 * real visual manager, and is actually done on this Node, not just installed
 * into the Project and never run here. Replaces what used to be a single
 * Browse tab hard coded to install-postgresql regardless of what a Service
 * or its Project actually uses.
 *
 * A database gets the Service's own scoped view (its own env vars decide
 * which database it uses); every other category shows this Node's whole
 * picture, since that scoping only exists for databases on the backend.
 */
export function ServiceBrowsePanel({
  nodeId,
  projectId,
  serviceId,
}: {
  nodeId: string;
  projectId: string;
  serviceId: string;
}) {
  const [refs, setRefs] = useState<InstalledCapabilityRef[] | null>(null);
  const [states, setStates] = useState<Record<string, CapabilityState>>({});
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    Promise.all([
      loadInstalledCapabilityRefs(projectId, controller.signal),
      getCapabilityStates(nodeId, projectId, controller.signal),
    ])
      .then(([installedRefs, capabilityStates]) => {
        if (!controller.signal.aborted) {
          setRefs(installedRefs);
          setStates(capabilityStates);
        }
      })
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) {
          setError(caught instanceof ApiError ? caught : new ApiError(0, 'unknown_error', 'This did not load.'));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [nodeId, projectId]);

  if (loading) {
    return <Loading label="Reading what this Project has installed" />;
  }
  if (error) {
    return <ErrorNote error={error} />;
  }

  const browsable = (refs ?? []).filter((ref) => hasVisualManager(ref.key) && Boolean(states[ref.key]));

  if (browsable.length === 0) {
    return (
      <EmptyState
        icon={Boxes}
        title="Nothing to browse yet"
        description="Once an installed app with a visual manager, a database, a web server, a message broker, and so on, has actually run on this server, its data shows up here."
      />
    );
  }

  return (
    <div className="flex flex-col divide-y divide-border">
      {browsable.map((ref) => {
        const isDatabase = isExplorableDatabase(ref.key);
        return (
          <div key={ref.key} className="py-5 first:pt-0 last:pb-0">
            <Text variant="caption" tone="secondary" className="mb-2 block">
              {ref.pluginName}
            </Text>
            <CapabilityManagerFor
              capabilityKey={ref.key}
              nodeId={nodeId}
              serviceId={isDatabase ? serviceId : undefined}
            />
            {isDatabase ? (
              // Export and restore live outside the Explorer itself, as
              // Actions CapabilityManagement already knows how to run; only
              // its own list-tables/browse-rows-shaped Actions are hidden,
              // since the Explorer above already covers those visually.
              <CapabilityManagement
                capabilityKey={ref.key}
                nodeId={nodeId}
                serviceId={serviceId}
                projectId={projectId}
                installed
                hideActionKeys={DATABASE_EXPLORER_ACTION_KEYS}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
