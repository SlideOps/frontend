import { MessageSquare } from '@slideops/icons';
import { ActionTable } from './ActionTable';

/**
 * The queues or, for NATS, JetStream streams a message broker Capability is
 * carrying, with how many messages are waiting and how many consumers are
 * attached. Both engines answer the same list-queues Action.
 */
export function MessagingManager({
  capabilityKey,
  nodeId,
  serviceId,
}: {
  capabilityKey: string;
  nodeId: string;
  serviceId?: string;
}) {
  const isNats = capabilityKey === 'install-nats';
  return (
    <ActionTable
      capabilityKey={capabilityKey}
      actionKey="list-queues"
      nodeId={nodeId}
      serviceId={serviceId}
      icon={MessageSquare}
      loadingLabel={isNats ? 'Reading JetStream streams' : 'Reading queues'}
      emptyTitle={isNats ? 'No streams yet' : 'No queues yet'}
      emptyDescription={
        isNats
          ? 'Turn JetStream on and create a stream to see it here.'
          : 'Once something declares a queue, it will show up here.'
      }
      searchPlaceholder={isNats ? 'Search streams...' : 'Search queues...'}
    />
  );
}

/** Whether MessagingManager knows how to draw this Capability. */
export function isMessagingCapability(capabilityKey: string): boolean {
  return ['install-rabbitmq', 'install-nats'].includes(capabilityKey);
}
