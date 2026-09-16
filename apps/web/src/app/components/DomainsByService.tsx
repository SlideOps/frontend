import type { Domain, Service } from '@slideops/api-client';
import { Section, Text } from '@slideops/design-system';
import { Layers } from '@slideops/icons';
import { Link } from 'react-router-dom';
import { servingReading } from '../domain-status';
import { StatusPill } from './DomainStatus';

/*
 * Which hostnames belong to which Service, read as a relationship rather than
 * as a list of rows to act on.
 *
 * Everything here already lives on the Domains tab and on each Service's own
 * page; this adds no new fact about a hostname, only a different shape for
 * the same one -- grouped by the Service it was claimed for, so "what does
 * this Service answer on" has an answer that does not require scanning a
 * flat list for a name. Managing a hostname -- adding, correcting, removing
 * it -- stays on the Domains tab and the hostname's own page.
 *
 * Only a software Service is shown: something an Operator deployed and runs,
 * which is what a hostname actually points at. A Capability Service is
 * infrastructure a Project depends on -- a database, a cache -- and is never
 * the target of a domain, so listing it here would be a row that can only
 * ever read "no hostname yet" and never explain why.
 */

export function DomainsByService({
  services,
  domains,
  nodeName,
}: {
  services: Service[];
  domains: Domain[];
  nodeName: (nodeId: string | undefined) => string;
}) {
  // Every Service ever deployed before deployment_type existed is software,
  // so a row with the field simply absent is kept rather than hidden.
  const deployed = services.filter((service) => service.deployment_type !== 'capability');

  return (
    <Section
      title="Services"
      adornment={<Layers width={16} height={16} className="text-brand" aria-hidden />}
      description="Every deployed Service in this Workspace, and the hostnames it answers on. A Service can have as many as it needs, or none yet."
    >
      {deployed.length === 0 ? (
        <Text variant="body-sm" tone="secondary">
          No deployed Services in this Workspace yet.
        </Text>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {deployed.map((service) => {
            const hostnames = domains.filter((domain) => domain.service_id === service.id);
            return (
              <div
                key={service.id}
                className="flex flex-col gap-2 rounded-md border border-border px-4 py-3"
              >
                <div className="flex flex-col gap-0.5">
                  <Link
                    to={`/app/services/${service.id}`}
                    className="truncate text-sm font-medium text-ink hover:underline"
                  >
                    {service.name}
                  </Link>
                  <Text variant="caption" tone="secondary">
                    on {nodeName(service.node_id)}
                  </Text>
                </div>
                {hostnames.length === 0 ? (
                  <Text variant="caption" tone="secondary">
                    No hostname yet. Reachable only at its address and port until one is added.
                  </Text>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {hostnames.map((domain) => (
                      <li key={domain.id} className="flex items-center gap-2">
                        <Link
                          to={`/app/domains/${domain.id}`}
                          className="min-w-0 flex-1 truncate font-mono text-sm text-brand hover:underline"
                        >
                          {domain.hostname}
                        </Link>
                        <StatusPill label="Serving" reading={servingReading(domain)} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
}
