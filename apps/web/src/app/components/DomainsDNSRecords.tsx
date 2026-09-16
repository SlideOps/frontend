import { ApiError, verifyDomain, type Domain } from '@slideops/api-client';
import { Button, Section, Text } from '@slideops/design-system';
import { Network } from '@slideops/icons';
import { useState } from 'react';
import { dnsReading } from '../domain-status';
import { DomainRecordFields, StatusPill } from './DomainStatus';

/*
 * DNS records and DNS state, across every hostname at once.
 *
 * SlideOps only ever creates or checks a record here; it never edits or
 * deletes one it did not create itself, and this view offers nothing that
 * could -- a real lookup against the world (Check DNS now) and the exact
 * record to create, exactly as they already exist on the Add a domain flow
 * and a hostname's own page. What is new is seeing every hostname's DNS
 * state side by side instead of one at a time.
 */

export function DomainsDNSRecords({
  domains,
  onChanged,
}: {
  domains: Domain[];
  onChanged: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const check = async (domain: Domain) => {
    setBusyId(domain.id);
    setError(null);
    try {
      await verifyDomain(domain.id);
      onChanged();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'That did not work. Try again.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Section
      title="DNS"
      adornment={<Network width={16} height={16} className="text-brand" aria-hidden />}
      description="What DNS actually answers for each hostname, checked against what the record was supposed to say. A real lookup, not what SlideOps hopes."
    >
      {error ? (
        <p role="alert" className="mb-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {domains.length === 0 ? (
        <Text variant="body-sm" tone="secondary">
          No domains in this Workspace yet.
        </Text>
      ) : (
        <div className="flex flex-col gap-3">
          {domains.map((domain) => (
            <div
              key={domain.id}
              className="flex flex-col gap-2 rounded-md border border-border px-4 py-3"
            >
              <div className="flex flex-wrap items-center gap-3">
                <span className="min-w-0 flex-1 truncate font-mono text-sm text-ink">
                  {domain.hostname}
                </span>
                <StatusPill label="DNS" reading={dnsReading(domain)} />
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busyId === domain.id}
                  onClick={() => check(domain)}
                >
                  {busyId === domain.id ? 'Checking' : 'Check DNS now'}
                </Button>
              </div>
              <div className="rounded-md border border-border bg-subtle px-3 py-2">
                <DomainRecordFields domain={domain} />
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}
