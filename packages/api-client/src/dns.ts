import { apiRequest } from './http';

/**
 * Connecting DNS, and choosing what answers for a Workspace's domains.
 *
 * Both are Owner or Admin only. A credential for a DNS zone can rewrite where a
 * company's mail goes, and the ingress decides what all of a Workspace's public
 * traffic passes through.
 */

/** Whether a connected credential still works. */
export type DNSConnectionState = 'unverified' | 'active' | 'invalid' | 'revoked';

/**
 * A connected DNS credential.
 *
 * There is deliberately no token here and no call that returns one. What matters
 * is which zone it manages and whether it still works.
 */
export interface DNSConnection {
  id: string;
  kind: 'cloudflare';
  label?: string;
  /** The one domain this credential is allowed to touch. */
  zone: string;
  state: DNSConnectionState;
  usable: boolean;
  last_error?: string;
  last_checked_at?: string;
  created_at: string;
}

/** What answers for a Workspace's domains. */
export interface WorkspaceIngressView {
  node_id: string;
  public_address: string;
  public_hostname?: string;
  enabled: boolean;
  /** The ingress server's address has changed since the DNS records were made,
   *  which breaks every hostname in the Workspace at once and is invisible
   *  without being told. */
  drifted: boolean;
  current_address?: string;
}

/** The DNS credentials this Workspace has connected. */
export function listDNSConnections(): Promise<DNSConnection[]> {
  return apiRequest<{ connections: DNSConnection[] }>('/dns/providers').then(
    (r) => r.connections ?? [],
  );
}

/**
 * Connect a credential so SlideOps can create the records a domain needs.
 *
 * It is checked against the zone before it is stored, so a token that cannot
 * manage it is refused now rather than failing later when somebody adds a domain.
 */
export function connectDNS(input: {
  kind: 'cloudflare';
  zone: string;
  token: string;
  label?: string;
}): Promise<DNSConnection> {
  return apiRequest<{ connection: DNSConnection }>('/dns/providers', {
    method: 'POST',
    body: input,
  }).then((r) => r.connection);
}

/**
 * Disconnect a credential. Records SlideOps already created are left in place:
 * they are correct and the sites they point at are still serving.
 */
export function disconnectDNS(id: string): Promise<void> {
  return apiRequest<void>(`/dns/providers/${encodeURIComponent(id)}`, { method: 'DELETE' }).then(
    () => undefined,
  );
}

/** What currently answers for this Workspace's domains. */
export function getWorkspaceIngress(): Promise<WorkspaceIngressView> {
  return apiRequest<WorkspaceIngressView>('/ingress');
}

/**
 * Route this Workspace's domains through one server, which forwards to whichever
 * server currently runs each Service. DNS then points at one address and never
 * moves again.
 */
export function chooseWorkspaceIngress(
  nodeId: string,
  publicHostname?: string,
): Promise<WorkspaceIngressView> {
  return apiRequest<WorkspaceIngressView>('/ingress', {
    method: 'POST',
    body: { node_id: nodeId, public_hostname: publicHostname ?? '' },
  });
}

/**
 * Stop routing through one server. New domains go back to being answered by the
 * server running their Service; domains that already exist keep their records.
 */
export function disableWorkspaceIngress(): Promise<void> {
  return apiRequest<void>('/ingress/disable', { method: 'POST' }).then(() => undefined);
}
