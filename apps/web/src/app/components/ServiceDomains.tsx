import { listServiceDomains, type Domain, type Service } from '@slideops/api-client';
import { Section, Text } from '@slideops/design-system';
import { Globe } from '@slideops/icons';
import { DomainRecordFields, ManageDomainsLink, StatusPill } from './DomainStatus';
import { ErrorNote, Loading } from './Feedback';
import { useAsyncData } from '../hooks/useAsyncData';
import { certificateReading, dnsReading, servingReading } from '../domain-status';

/*
 * A Service's domains, as a summary.
 *
 * Adding, checking and provisioning used to happen here as well, and that was
 * the problem rather than a convenience. A hostname that is not serving is a
 * chain of four things, only one of which is about this Service, and the same
 * flow existed again on the Node page and again under networking. Three copies
 * of one journey is how an Operator ends up checking DNS in one place and
 * reading the certificate in another.
 *
 * So the state stays here, because a Service that cannot tell you its own
 * addresses is a worse page. The flow that changes it lives in one place, and
 * this points at it.
 */

export function ServiceDomains({ service }: { service: Service }) {
  const domains = useAsyncData<Domain[]>(() => listServiceDomains(service.id), [service.id]);
  const list = domains.state.status === 'ready' ? domains.state.data : [];

  return (
    <Section
      title="Domains"
      adornment={<Globe width={16} height={16} className="text-brand" aria-hidden />}
      description="The addresses this Service answers on. SlideOps handles the routing and the certificate; you point the name at it."
      action={
        <ManageDomainsLink
          label="Manage domains and DNS"
          to={`/app/domains?service=${encodeURIComponent(service.id)}`}
        />
      }
    >
      {domains.state.status === 'loading' ? <Loading /> : null}
      {domains.state.status === 'error' ? <ErrorNote error={domains.state.error} /> : null}

      <div className="flex flex-col gap-3">
        {list.map((domain) => (
          <div key={domain.id} className="flex flex-col gap-3 rounded-md border border-border px-4 py-3">
            <div className="min-w-0">
              {domain.serving ? (
                <a
                  href={domain.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-sm text-brand underline"
                >
                  {domain.hostname}
                </a>
              ) : (
                <span className="font-mono text-sm text-ink">{domain.hostname}</span>
              )}
              <Text variant="caption" tone="secondary" className="mt-0.5 block">
                {domain.state_detail}
              </Text>
            </div>

            <div className="flex flex-wrap gap-x-8 gap-y-3">
              <StatusPill label="DNS" reading={dnsReading(domain)} />
              <StatusPill label="Certificate" reading={certificateReading(domain)} />
              <StatusPill label="Serving" reading={servingReading(domain)} />
            </div>

            {domain.last_error ? (
              <Text variant="caption" tone="secondary">
                {domain.last_error}
              </Text>
            ) : null}

            {/* The record itself is not a control, and it is what somebody
                sitting on this tab actually needs to copy, so it stays. */}
            {domain.state === 'pending_dns' || domain.state === 'dns_verifying' ? (
              <div className="rounded-md border border-border bg-subtle px-3 py-2">
                <Text variant="caption" tone="secondary" className="block">
                  Create this record with whoever manages DNS for {domain.hostname}, then check it
                  from Domains and DNS.
                </Text>
                <div className="mt-2">
                  <DomainRecordFields domain={domain} />
                </div>
              </div>
            ) : null}
          </div>
        ))}
        {list.length === 0 && domains.state.status === 'ready' ? (
          <Text variant="body-sm" tone="secondary">
            This Service has no domain yet. Add one from Domains and DNS and it will be reachable at
            a name instead of an address and a port.
          </Text>
        ) : null}
      </div>
    </Section>
  );
}
