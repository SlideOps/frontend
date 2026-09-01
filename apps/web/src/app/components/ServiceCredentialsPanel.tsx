import { ApiError, getCapabilityStates, type CapabilityState } from '@slideops/api-client';
import { Section } from '@slideops/design-system';
import { useEffect, useState } from 'react';
import { InstalledCapabilityCredentials } from './InstalledCapabilityCredentials';
import { loadInstalledCapabilityRefs, type InstalledCapabilityRef } from '../installed-capabilities';
import { ErrorNote, Loading } from './Feedback';

/**
 * Every installed app's own configuration and credentials, on a Service's
 * Settings page: what used to only exist on that Capability's own detail
 * page is now reachable from here too, since an Operator looking at a
 * Service is often looking for exactly this, the database password or the
 * search engine's master key, without needing to already know which
 * Capability page it lives on.
 */
export function ServiceCredentialsPanel({
  nodeId,
  projectId,
  host,
}: {
  nodeId: string;
  projectId: string;
  host?: string;
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
    return <Loading label="Reading installed apps" />;
  }
  if (error) {
    return <ErrorNote error={error} />;
  }

  const withCredentials = (refs ?? []).filter((ref) => Boolean(states[ref.key]?.last_operation_id));

  if (withCredentials.length === 0) {
    return null;
  }

  return (
    <Section
      title="Installed apps"
      description="Configuration and credentials for what this Project has installed and actually run on this server."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        {withCredentials.map((ref) => (
          <InstalledCapabilityCredentials
            key={ref.key}
            pluginName={ref.pluginName}
            operationId={states[ref.key]!.last_operation_id!}
            host={host}
          />
        ))}
      </div>
    </Section>
  );
}
