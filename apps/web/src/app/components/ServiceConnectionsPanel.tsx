import { getServiceConnections, type ServiceConnection } from '@slideops/api-client';
import { Section, Text } from '@slideops/design-system';
import { Waypoints } from '@slideops/icons';
import { useAsyncData } from '../hooks/useAsyncData';

/** A readable Capability name from its key, in Operator language. */
function capabilityName(key: string): string {
  return key
    .replace(/^install-/, '')
    .replace(/[-_]+/g, ' ')
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
}

/**
 * What this Service is connected to, the reverse of the "Used by" list a
 * Capability's own credential card shows: every database or cache this
 * Service's environment was wired to through Connect. Renders nothing when
 * this Service has never used Connect, so an ordinary Service's Settings
 * tab stays exactly as it was.
 */
export function ServiceConnectionsPanel({ serviceId }: { serviceId: string }) {
  const result = useAsyncData<ServiceConnection[]>(
    (signal) => getServiceConnections(serviceId, signal),
    [serviceId],
  );

  if (result.state.status !== 'ready' || result.state.data.length === 0) {
    return null;
  }

  return (
    <Section
      title="Connected to"
      description="What this Service was wired to through Connect. Each one wrote its host, port, and credentials into this Service's environment."
    >
      <ul className="flex flex-col gap-2">
        {result.state.data.map((connection) => (
          <li key={connection.id} className="flex items-center gap-2">
            <Waypoints width={14} height={14} className="text-ink-muted" aria-hidden />
            <Text variant="body-sm" className="text-ink">
              {capabilityName(connection.source_capability_key)}
            </Text>
            <Text variant="caption" tone="secondary">
              {connection.env_prefix}_*
            </Text>
          </li>
        ))}
      </ul>
    </Section>
  );
}
