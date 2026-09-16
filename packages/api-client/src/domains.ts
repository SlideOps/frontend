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
  /** How the proxy speaks to the Service behind it. Almost always http: TLS is
   *  terminated at the ingress and the hop to the workload is private. */
  target_scheme: 'http' | 'https';
  /** What the route on the server was last written with. Absent when this
   *  hostname has never been put live. */
  provisioned_port?: number;
  /** The record has been corrected and the server has not caught up: it is
   *  routing to `provisioned_port` while the record now asks for
   *  `target_port`. Putting the domain live again settles it. */
  needs_reapply: boolean;
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

  /** Which Server Domain this hostname was tagged as belonging to, absent
   *  for a hostname entered free-form -- which is how every hostname
   *  worked before Server Domains existed, and still an entirely ordinary
   *  way to add one. */
  server_domain_id?: string;
  /** Whether the DNS provider is proxying this hostname, absent when not
   *  known: SlideOps has never asked, which is not the same as knowing it
   *  is plain DNS. Never sent as a third "not applicable" value -- read
   *  that from `dns_mode` instead (manual DNS, or no provider connected,
   *  is where proxying simply does not apply). */
  proxy_mode?: 'dns_only' | 'proxied';
  /** How this hostname gets its certificate. `http01` is the ordinary case
   *  and the only thing every hostname has ever done. `dns01` is for a
   *  domain proxied through Cloudflare, where the ordinary challenge can
   *  never reach the server. */
  cert_method: 'http01' | 'dns01';
}

/** A domain namespace: a domain made available for a Server's Services to
 *  claim subdomains under. Adding one creates no hostname, writes no route,
 *  and requests no certificate by itself -- a Service's own "Add hostname"
 *  flow does that, exactly as it always has, optionally under this
 *  namespace. */
export interface ServerDomain {
  id: string;
  node_id: string;
  domain: string;
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

/** One hostname, with everything recorded about it. */
export function getDomain(id: string): Promise<Domain> {
  return apiRequest<{ domain: Domain }>(`/domains/${encodeURIComponent(id)}`).then((r) => r.domain);
}

/**
 * Correct where a hostname points inside its Service.
 *
 * The hostname itself cannot be changed: a different hostname is a different
 * hostname, with its own DNS record and its own certificate, so it is claimed
 * and released rather than renamed.
 *
 * Nothing on the server changes here. The route is rewritten by putting the
 * domain live again, and until then the domain comes back with `needs_reapply`
 * set, so what the server is routing and what the record now asks for are both
 * visible rather than one quietly standing in for the other.
 *
 * cert_method, proxy_mode and server_domain_id are optional and independent
 * of the port/scheme correction: send only the ones you mean to change.
 * cert_method requests nothing from a certificate authority here -- that
 * happens the next time this domain is put live. server_domain_id is
 * refused if the hostname is not actually under that namespace's domain.
 */
export function updateDomain(
  id: string,
  target: {
    port: number;
    scheme?: 'http' | 'https';
    certMethod?: 'http01' | 'dns01';
    /** '' clears it back to not known. */
    proxyMode?: 'dns_only' | 'proxied' | '';
    serverDomainId?: string;
  },
): Promise<Domain> {
  return apiRequest<{ domain: Domain }>(`/domains/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: {
      port: target.port,
      scheme: target.scheme,
      cert_method: target.certMethod,
      proxy_mode: target.proxyMode,
      server_domain_id: target.serverDomainId,
    },
  }).then((r) => r.domain);
}

/** Every hostname in the Workspace. */
export function listWorkspaceDomains(): Promise<Domain[]> {
  return apiRequest<{ domains: Domain[] }>('/domains').then((r) => r.domains ?? []);
}

/**
 * What a server is actually routing, against what SlideOps intends.
 *
 * The two directions mean different things. A domain SlideOps expects and does
 * not find has been removed by something and can be put back. A site the server
 * answers for that no domain claims is almost always the Operator's own work, and
 * is reported rather than touched.
 */
export interface RouteDrift {
  node_id: string;
  /** Domains SlideOps believes are serving that have no route on the server. */
  missing: string[];
  /** Sites the server serves that no domain claims. Never removed. */
  unmanaged: string[];
  healthy: boolean;
  summary: string;
}

/** Read a server's routing against what was intended. Changes nothing. */
export function inspectNodeRoutes(nodeId: string): Promise<RouteDrift> {
  return apiRequest<RouteDrift>(`/nodes/${encodeURIComponent(nodeId)}/routes`);
}

/**
 * Put back the routes a server is missing. Sites SlideOps did not set up are
 * never removed.
 */
export function repairNodeRoutes(nodeId: string): Promise<RouteDrift> {
  return apiRequest<RouteDrift>(`/nodes/${encodeURIComponent(nodeId)}/routes/repair`, {
    method: 'POST',
  });
}

/** The domains available as a namespace on one Server. */
export function listServerDomains(nodeId: string): Promise<ServerDomain[]> {
  return apiRequest<{ server_domains: ServerDomain[] }>(
    `/nodes/${encodeURIComponent(nodeId)}/server-domains`,
  ).then((r) => r.server_domains ?? []);
}

/**
 * Make a domain available as a namespace for a Server's Services to claim
 * subdomains under.
 *
 * This creates no hostname, writes no route, and requests no certificate by
 * itself. **Owner or Admin only.**
 */
export function addServerDomain(nodeId: string, domain: string): Promise<ServerDomain> {
  return apiRequest<{ server_domain: ServerDomain }>(
    `/nodes/${encodeURIComponent(nodeId)}/server-domains`,
    { method: 'POST', body: { domain } },
  ).then((r) => r.server_domain);
}

/**
 * Take a domain away as a namespace.
 *
 * Every hostname tagged under it keeps its route, its DNS record, and its
 * certificate exactly as they were -- this only removes the namespace
 * itself. **Owner or Admin only.**
 */
export function removeServerDomain(id: string): Promise<void> {
  return apiRequest<void>(`/server-domains/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  }).then(() => undefined);
}
