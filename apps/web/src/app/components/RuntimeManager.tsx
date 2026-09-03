import { Cpu } from '@slideops/icons';
import { ActionTable } from './ActionTable';

/**
 * A language runtime's own version and every process of it currently running,
 * so an Operator can see what is actually using Node.js or Python on this
 * server without a shell.
 */
export function RuntimeManager({
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
      actionKey="runtime-status"
      nodeId={nodeId}
      serviceId={serviceId}
      icon={Cpu}
      loadingLabel="Reading runtime status"
      emptyTitle="Nothing running yet"
      emptyDescription="Once something runs on this runtime, its process will show up here."
      searchPlaceholder="Search processes..."
    />
  );
}

/** Whether RuntimeManager knows how to draw this Capability. */
export function isRuntimeCapability(capabilityKey: string): boolean {
  return ['install-nodejs', 'install-python'].includes(capabilityKey);
}
