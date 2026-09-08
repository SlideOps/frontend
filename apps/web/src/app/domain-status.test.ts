import { describe, expect, it } from 'vitest';
import type { Domain } from '@slideops/api-client';
import {
  certificateReading,
  dnsReading,
  dnsVerified,
  filterDomains,
  groupDomains,
  nodeIdsWithDomains,
  remediationFor,
  routeWritten,
  type DomainNames,
} from './domain-status';

function domain(over: Partial<Domain> = {}): Domain {
  return {
    id: 'dom-1',
    hostname: 'api.example.com',
    url: 'https://api.example.com',
    service_id: 'svc-api',
    node_id: 'node-1',
    target_port: 3000,
    state: 'pending_dns',
    state_detail: 'Waiting for DNS to point here.',
    serving: false,
    tls_state: 'pending',
    dns_mode: 'manual',
    record: { type: 'A', name: 'api', value: '203.0.113.10', ttl: 'Auto' },
    created_at: '2026-09-07T10:00:00Z',
    ...over,
  } as Domain;
}

const names: DomainNames = {
  service: new Map([
    ['svc-api', 'api'],
    ['svc-web', 'web'],
  ]),
  node: new Map([['node-1', 'shared-box']]),
};

describe('reading a domain', () => {
  it('says DNS has not been checked rather than calling an unchecked name healthy', () => {
    expect(dnsReading(domain()).label).toBe('Not checked');
  });

  it('reports the expected target beside the one that actually answered', () => {
    const reading = dnsReading(
      domain({ dns_checked_at: '2026-09-07T11:00:00Z', dns_observed: '198.51.100.7' }),
    );
    expect(reading.label).toBe('Points elsewhere');
    expect(reading.detail).toBe('Expected 203.0.113.10, found 198.51.100.7.');
  });

  it('treats a name that answers with the expected value as pointing here', () => {
    const reading = dnsReading(
      domain({ dns_checked_at: '2026-09-07T11:00:00Z', dns_observed: '203.0.113.10' }),
    );
    expect(reading.label).toBe('Points here');
    expect(dnsVerified(domain({ dns_observed: '203.0.113.10' }))).toBe(true);
  });

  it('does not treat a state that never reached DNS as verified', () => {
    expect(dnsVerified(domain())).toBe(false);
    expect(dnsVerified(domain({ state: 'failed' }))).toBe(false);
  });

  it('counts a route as written only once the server is actually serving the name', () => {
    expect(routeWritten(domain({ state: 'dns_verified' }))).toBe(false);
    expect(routeWritten(domain({ state: 'routing_active' }))).toBe(true);
    expect(routeWritten(domain({ state: 'active' }))).toBe(true);
  });

  it('warns before a certificate lapses rather than after', () => {
    const now = new Date('2026-09-08T00:00:00Z');
    const soon = certificateReading(
      domain({ tls_state: 'active', tls_expires_at: '2026-09-14T00:00:00Z' }),
      now,
    );
    expect(soon.tone).toBe('warn');
    expect(soon.label).toBe('Expires in 6 days');

    const expired = certificateReading(
      domain({ tls_state: 'active', tls_expires_at: '2026-09-01T00:00:00Z' }),
      now,
    );
    expect(expired.label).toBe('Expired');
  });

  it('does not claim a certificate is valid when no expiry came back', () => {
    const reading = certificateReading(domain({ tls_state: 'active' }));
    expect(reading.detail).toBe('No expiry date was returned.');
  });
});

describe('what to do next about a domain', () => {
  it('offers a DNS check, and nothing that touches a server, while DNS is unproven', () => {
    const remediation = remediationFor(domain());
    expect(remediation?.kind).toBe('verify');
    expect(remediation?.explanation).toContain('Nothing on any server changes');
  });

  it('offers provisioning once DNS points here', () => {
    expect(remediationFor(domain({ state: 'dns_verified' }))?.kind).toBe('provision');
  });

  // There is no standalone certificate call, so the remediation says what it
  // really is instead of offering a Reissue button that is something else.
  it('says a failed certificate is fixed by running provisioning again', () => {
    const remediation = remediationFor(domain({ state: 'active', tls_state: 'failed' }));
    expect(remediation?.label).toBe('Run provisioning again');
    expect(remediation?.explanation).toContain('no separate certificate retry');
  });

  it('offers nothing to do for a domain that is already serving', () => {
    expect(remediationFor(domain({ state: 'active', serving: true, tls_state: 'active' }))).toBe(
      null,
    );
  });
});

describe('narrowing and gathering the list', () => {
  const web = domain({ id: 'dom-2', hostname: 'web.example.com', service_id: 'svc-web' });
  const all = [domain(), web];

  it('finds a domain by the name of the Service it belongs to, not only by hostname', () => {
    const found = filterDomains(all, { query: 'web', state: 'all', nodeId: 'all', serviceId: 'all' }, names);
    expect(found.map((d) => d.id)).toEqual(['dom-2']);
  });

  it('narrows to one server and to one status independently', () => {
    expect(
      filterDomains(all, { query: '', state: 'all', nodeId: 'node-1', serviceId: 'all' }, names),
    ).toHaveLength(2);
    expect(
      filterDomains(all, { query: '', state: 'active', nodeId: 'all', serviceId: 'all' }, names),
    ).toHaveLength(0);
  });

  // Several Services commonly share one server, each with its own hostname, and
  // no other screen answers "what does this box answer for".
  it('gathers two Services sharing one server under that one server', () => {
    const groups = groupDomains(all, 'node', names);
    expect(groups).toHaveLength(1);
    expect(groups.at(0)?.label).toBe('shared-box');
    expect(groups.at(0)?.domains).toHaveLength(2);
  });

  it('keeps two Services on one server apart when gathered by Service', () => {
    const groups = groupDomains(all, 'service', names);
    expect(groups.map((group) => group.label)).toEqual(['api', 'web']);
  });

  it('names a server it cannot resolve rather than showing a bare id', () => {
    const groups = groupDomains([domain({ node_id: 'node-gone' })], 'node', names);
    expect(groups.at(0)?.label).toBe('Unknown server');
  });

  it('lists each server holding domains once, for the routing check', () => {
    expect(nodeIdsWithDomains(all)).toEqual(['node-1']);
  });
});
