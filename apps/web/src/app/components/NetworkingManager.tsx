import { Network } from '@slideops/icons';
import { useState } from 'react';
import { ActionTable } from './ActionTable';

/**
 * The peers configured on a WireGuard interface: who they are, where they
 * last connected from, and how much data has moved. wg0 is the default
 * interface configure-wireguard brings up; the field here only matters on the
 * rare Node that was configured with a different name.
 */
export function NetworkingManager({
  capabilityKey,
  nodeId,
  serviceId,
}: {
  capabilityKey: string;
  nodeId: string;
  serviceId?: string;
}) {
  const [iface, setIface] = useState('wg0');
  return (
    <ActionTable
      capabilityKey={capabilityKey}
      actionKey="list-peers"
      nodeId={nodeId}
      serviceId={serviceId}
      parameters={{ interface: iface }}
      icon={Network}
      loadingLabel="Reading peers"
      emptyTitle="No peers yet"
      emptyDescription="Add a peer to this interface, and it will show up here."
      searchPlaceholder="Search peers..."
      toolbarExtra={
        <label className="flex items-center gap-1.5 text-sm text-ink-muted">
          Interface
          <input
            value={iface}
            onChange={(event) => setIface(event.target.value.trim() || 'wg0')}
            className="h-8 w-20 rounded-md border border-border bg-surface px-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            aria-label="WireGuard interface"
          />
        </label>
      }
    />
  );
}

/** Whether NetworkingManager knows how to draw this Capability. */
export function isNetworkingCapability(capabilityKey: string): boolean {
  return capabilityKey === 'configure-wireguard';
}
