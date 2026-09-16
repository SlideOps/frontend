import type { Domain } from '@slideops/api-client';
import { Section, Text } from '@slideops/design-system';
import { ShieldCheck } from '@slideops/icons';
import { Link } from 'react-router-dom';
import { certificateReading } from '../domain-status';
import { StatusPill } from './DomainStatus';

/*
 * Certificate method and certificate state, across every hostname at once.
 *
 * This is deliberately read only. Changing a hostname's certificate method or
 * proxy mode already has one home, its own detail page, where it sits next to
 * the Server Domain it may be tagged under -- rebuilding that form here would
 * be a second place the same write could happen from, which is exactly what
 * this reorganization exists to stop. What this adds is the view neither the
 * Domains list nor any one hostname's page gives: every certificate's state
 * and method side by side, so a proxied hostname still left on HTTP-01 is
 * visible without opening each one in turn.
 */

const CERT_METHOD_LABEL: Record<Domain['cert_method'], string> = {
  http01: 'HTTP-01',
  dns01: 'DNS-01 via Cloudflare',
};

const PROXY_MODE_LABEL: Record<'' | 'dns_only' | 'proxied', string> = {
  '': 'Proxy mode not set',
  dns_only: 'DNS only',
  proxied: 'Proxied',
};

export function DomainsCertificates({ domains }: { domains: Domain[] }) {
  // The one combination that cannot work: a proxied hostname still relying on
  // HTTP-01, since the challenge lands on Cloudflare's edge rather than here.
  const misconfigured = domains.filter(
    (domain) => domain.proxy_mode === 'proxied' && domain.cert_method === 'http01',
  );

  return (
    <Section
      title="Certificates"
      adornment={<ShieldCheck width={16} height={16} className="text-brand" aria-hidden />}
      description="How each hostname gets its certificate, and whether it has one. To change a method or a proxy mode, open the hostname: this view is read only on purpose, so there is one place a change like that is ever made."
    >
      {misconfigured.length > 0 ? (
        <div className="mb-3 rounded-md border border-warning bg-subtle px-3 py-2">
          <Text variant="body-sm" className="font-medium">
            {misconfigured.length === 1
              ? '1 hostname is proxied but still set to HTTP-01'
              : `${misconfigured.length} hostnames are proxied but still set to HTTP-01`}
          </Text>
          <Text variant="caption" tone="secondary" className="mt-1 block">
            A proxied hostname cannot complete an HTTP-01 challenge. Open each one below and switch
            it to DNS-01.
          </Text>
        </div>
      ) : null}

      {domains.length === 0 ? (
        <Text variant="body-sm" tone="secondary">
          No domains in this Workspace yet.
        </Text>
      ) : (
        <div className="flex flex-col gap-2">
          {domains.map((domain) => (
            <div
              key={domain.id}
              className="flex flex-wrap items-center gap-4 rounded-md border border-border px-4 py-3"
            >
              <Link
                to={`/app/domains/${domain.id}`}
                className="min-w-0 flex-1 truncate font-mono text-sm text-brand hover:underline"
              >
                {domain.hostname}
              </Link>
              <StatusPill label="Certificate" reading={certificateReading(domain)} />
              <Text variant="caption" tone="secondary" className="w-40 shrink-0">
                {CERT_METHOD_LABEL[domain.cert_method]}
              </Text>
              <Text variant="caption" tone="secondary" className="w-36 shrink-0">
                {PROXY_MODE_LABEL[domain.proxy_mode ?? '']}
              </Text>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}
