import {
  ApiError,
  provisionDomain,
  verifyDomain,
  type Domain,
  type Node,
} from '@slideops/api-client';
import { Button, Section, Text } from '@slideops/design-system';
import { AlertTriangle, Stethoscope } from '@slideops/icons';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  certificateReading,
  dnsReading,
  nodeIdsWithDomains,
  remediationFor,
  routingReading,
  servingReading,
} from '../domain-status';
import { StatusPill } from './DomainStatus';
import { RoutingDrift } from './RoutingDrift';

/*
 * The four-state diagnostics, and the one server-level check that has no
 * per-hostname equivalent, gathered where troubleshooting actually starts:
 * not "manage my domains" but "what is broken and what fixes it".
 *
 * DNS, Routing, Certificate and Serving fail independently and each has a
 * different fix -- that rule carries over from the Domains list unchanged,
 * reusing the exact same readings and the exact same remediation a hostname's
 * own page offers, so there is nothing new to keep in sync. What changes is
 * the ordering and the omissions: problems first, and no Add, no search, no
 * remove -- this tab exists to say what is wrong and offer the one fix, not
 * to manage the list.
 */

export function DomainsDiagnostics({
  domains,
  nodes,
  onChanged,
}: {
  domains: Domain[];
  nodes: Node[];
  onChanged: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (domain: Domain, action: () => Promise<unknown>) => {
    setBusyId(domain.id);
    setError(null);
    try {
      await action();
      onChanged();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'That did not work. Try again.');
    } finally {
      setBusyId(null);
    }
  };

  // Problems first: what needs a look does not wait behind what is already
  // fine. Domains that are equally healthy, or equally not, keep the order
  // they were read in.
  const sorted = [...domains].sort((a, b) => Number(a.serving) - Number(b.serving));
  const nodeName = (id: string) => nodes.find((candidate) => candidate.id === id)?.name ?? 'Unknown server';

  return (
    <div className="flex flex-col gap-8">
      <Section
        title="Routing on your servers"
        adornment={<Stethoscope width={16} height={16} className="text-brand" aria-hidden />}
        description="What each server is actually serving, checked against the domains SlideOps put on it. Read only until you press something."
      >
        {nodeIdsWithDomains(domains).length === 0 ? (
          <Text variant="body-sm" tone="secondary">
            No domain is attached to a server yet, so there is no routing to check.
          </Text>
        ) : (
          <div className="flex flex-col gap-3">
            {nodeIdsWithDomains(domains).map((id) => (
              <RoutingDrift key={id} nodeId={id} nodeName={nodeName(id)} />
            ))}
          </div>
        )}
      </Section>

      <Section
        title="Every hostname's four states"
        description="DNS, Routing, Certificate and Serving fail separately and each has a different fix. The ones needing attention are listed first."
      >
        {error ? (
          <p role="alert" className="mb-3 text-sm text-danger">
            {error}
          </p>
        ) : null}

        {sorted.length === 0 ? (
          <Text variant="body-sm" tone="secondary">
            No domains in this Workspace yet.
          </Text>
        ) : (
          <div className="flex flex-col gap-3">
            {sorted.map((domain) => {
              const remediation = remediationFor(domain);
              return (
                <div
                  key={domain.id}
                  className="flex flex-col gap-3 rounded-md border border-border px-4 py-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link
                      to={`/app/domains/${domain.id}`}
                      className="min-w-0 truncate font-mono text-sm text-brand hover:underline"
                    >
                      {domain.hostname}
                    </Link>
                    {!domain.serving ? (
                      <AlertTriangle
                        width={15}
                        height={15}
                        className="shrink-0 text-warning"
                        aria-hidden
                      />
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-x-8 gap-y-3">
                    <StatusPill label="DNS" reading={dnsReading(domain)} />
                    <StatusPill label="Routing" reading={routingReading(domain)} />
                    <StatusPill label="Certificate" reading={certificateReading(domain)} />
                    <StatusPill label="Serving" reading={servingReading(domain)} />
                  </div>
                  {domain.last_error ? (
                    <Text variant="caption" tone="secondary">
                      {domain.last_error}
                    </Text>
                  ) : null}
                  {remediation ? (
                    <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
                      <Text variant="caption" tone="secondary" className="min-w-0 flex-1">
                        {remediation.explanation}
                      </Text>
                      <Button
                        size="sm"
                        disabled={busyId === domain.id}
                        onClick={() =>
                          run(
                            domain,
                            remediation.kind === 'verify'
                              ? () => verifyDomain(domain.id)
                              : () => provisionDomain(domain.id),
                          )
                        }
                      >
                        {busyId === domain.id ? 'Working' : remediation.label}
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );
}
