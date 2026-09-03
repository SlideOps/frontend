import { Globe } from '@slideops/icons';
import { ActionTable } from './ActionTable';

/**
 * The virtual hosts or frontends a web server Capability has configured,
 * whichever engine it is (nginx, Apache, or HAProxy all answer the same
 * list-sites Action, in the same column shape).
 */
export function WebSitesManager({
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
      actionKey="list-sites"
      nodeId={nodeId}
      serviceId={serviceId}
      icon={Globe}
      loadingLabel="Reading configured sites"
      emptyTitle="No sites configured yet"
      emptyDescription="Once a site or virtual host is enabled, it will show up here."
      searchPlaceholder="Search sites..."
    />
  );
}

/** Whether WebSitesManager knows how to draw this Capability. */
export function isWebSitesCapability(capabilityKey: string): boolean {
  return ['install-nginx', 'install-apache', 'install-haproxy'].includes(capabilityKey);
}
