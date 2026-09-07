import { apiRequest } from './http';

/**
 * A Service's domains.
 *
 * A hostname belongs to a Service, not to a server. SlideOps records which
 * Service owns a name, tells the world where to point, and handles the routing
 * and the certificate once it does.
 */

/**
 * Where a hostname has got to.
 *
 * These are separate because the fixes are different. Reporting all of them as
 * failed is what sends an Operator to a terminal, which is the work this is
 * meant to remove.
 */
export type DomainState =
  | 'pending_dns'
  | 'dns_verifying'
  | 'dns_verified'
  | 'routing_pending'
  | 'routing_active'
  | 'tls_pending'
  | 'active'
  | 'degraded'
  | 'failed'
  | 'detached';

/** The DNS record to create, ready to copy rather than described. */
export interface DomainRecord {
  type: string;
  /** The label a registrar's form asks for, not the whole hostname. */
  name: string;
  value: string;
  ttl: string;
}

export interface Domain {
  id: string;
  hostname: string;
  url: string;
  service_id: string;
  node_id?: string;
  /** The port the application listens on inside its container. The public
   *  always reaches it on 443. */
  target_port: number;
  state: DomainState;
  /** What the state means, in the Operator's own terms. */
  state_detail: string;
  serving: boolean;
  last_error?: string;
  tls_state: 'pending' | 'active' | 'failed' | 'not_applicable';
  tls_expires_at?: string;
  dns_mode: 'manual' | 'provider';
  /** What DNS actually answered, which is not the same as what SlideOps was
   *  told to expect. */
  dns_observed?: string;
  dns_checked_at?: string;
  record: DomainRecord;
  created_at: string;
}

/** Every hostname a Service answers on. */
export function listServiceDomains(serviceId: string): Promise<Domain[]> {
  return apiRequest<{ domains: Domain[] }>(
    `/services/${encodeURIComponent(serviceId)}/domains`,
  ).then((r) => r.domains ?? []);
}

/**
 * Claim a hostname for a Service.
 *
 * Nothing is configured on any server yet: a hostname that does not resolve has
 * nothing to route and no certificate can be issued for it. The domain comes back
 * with the exact record to create.
 */
export function addServiceDomain(
  serviceId: string,
  hostname: string,
  port: number,
): Promise<Domain> {
  return apiRequest<{ domain: Domain }>(`/services/${encodeURIComponent(serviceId)}/domains`, {
    method: 'POST',
    body: { hostname, port },
  }).then((r) => r.domain);
}

/**
 * Look the hostname up for real.
 *
 * This asks DNS, not SlideOps' own records. Whether a browser can reach the
 * hostname is a question only a resolver can answer.
 */
export function verifyDomain(id: string): Promise<Domain> {
  return apiRequest<{ domain: Domain }>(`/domains/${encodeURIComponent(id)}/verify`, {
    method: 'POST',
  }).then((r) => r.domain);
}

/**
 * Put the domain live: open the web ports, route the hostname to the Service,
 * and get a certificate. Refused while DNS does not point here.
 */
export function provisionDomain(id: string): Promise<Domain> {
  return apiRequest<{ domain: Domain }>(`/domains/${encodeURIComponent(id)}/provision`, {
    method: 'POST',
  }).then((r) => r.domain);
}

/**
 * Stop serving a hostname and release it.
 *
 * Only this hostname's own route is removed. Every other site on the same server
 * keeps working, and no DNS record is touched.
 */
export function removeDomain(id: string): Promise<void> {
  return apiRequest<void>(`/domains/${encodeURIComponent(id)}`, { method: 'DELETE' }).then(
    () => undefined,
  );
}

/** Every hostname in the Workspace. */
export function listWorkspaceDomains(): Promise<Domain[]> {
  return apiRequest<{ domains: Domain[] }>('/domains').then((r) => r.domains ?? []);
}
