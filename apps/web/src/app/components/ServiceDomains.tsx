import {
  ApiError,
  addServiceDomain,
  listServiceDomains,
  provisionDomain,
  removeDomain,
  verifyDomain,
  type Domain,
  type Service,
} from '@slideops/api-client';
import { Button, Section, Text } from '@slideops/design-system';
import { AlertTriangle, Check, Globe, RefreshCw } from '@slideops/icons';
import { useState, type FormEvent } from 'react';
import { useCanWrite } from '../../store/workspace';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { CopyButton } from './CopyButton';
import { ErrorNote, Loading } from './Feedback';
import { useAsyncData } from '../hooks/useAsyncData';

/*
 * A Service's domains.
 *
 * The whole point is that adding one is a Service setting, not a server
 * administration task. So this page never mentions a reverse proxy, a certificate
 * authority, an upstream, a bridge address, or a port to publish. It asks for a
 * hostname and the port the application already listens on, and then says which of
 * the three things that have to be true is not true yet.
 *
 * Those three are kept apart deliberately. DNS not pointing here, a route that was
 * not written, and a certificate that would not issue have different fixes, and
 * only the first is the Operator's to make. Collapsing them into "failed" is what
 * sends somebody to a terminal.
 */

const inputClass =
  'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';

/** Whether a state means the Operator is waiting on DNS they must create. */
function waitingOnDNS(domain: Domain): boolean {
  return domain.state === 'pending_dns' || domain.state === 'dns_verifying';
}

export function ServiceDomains({ service }: { service: Service }) {
  const canWrite = useCanWrite();
  const domains = useAsyncData<Domain[]>(() => listServiceDomains(service.id), [service.id]);

  const [hostname, setHostname] = useState('');
  const [port, setPort] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Domain | null>(null);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      domains.reload();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'That did not work. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const add = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = Number(port);
    if (!Number.isInteger(parsed) || parsed < 1) {
      setError('Enter the port your application listens on inside its container, such as 3000.');
      return;
    }
    await run(async () => {
      await addServiceDomain(service.id, hostname.trim(), parsed);
      setHostname('');
      setPort('');
    });
  };

  const list = domains.state.status === 'ready' ? domains.state.data : [];

  return (
    <Section
      title="Domains"
      adornment={<Globe width={16} height={16} className="text-brand" aria-hidden />}
      description="The addresses this Service answers on. SlideOps handles the routing and the certificate; you point the name at it."
    >
      {domains.state.status === 'loading' ? <Loading /> : null}
      {domains.state.status === 'error' ? <ErrorNote error={domains.state.error} /> : null}

      <div className="flex flex-col gap-3">
        {list.map((domain) => (
          <DomainRow
            key={domain.id}
            domain={domain}
            canWrite={canWrite}
            busy={busy}
            onVerify={() => run(() => verifyDomain(domain.id))}
            onProvision={() => run(() => provisionDomain(domain.id))}
            onRemove={() => setRemoving(domain)}
          />
        ))}
        {list.length === 0 && domains.state.status === 'ready' ? (
          <Text variant="body-sm" tone="secondary">
            This Service has no domain yet. Add one and it will be reachable at a name instead of an
            address and a port.
          </Text>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {canWrite ? (
        <form className="mt-4 flex flex-col gap-3 border-t border-border pt-4" onSubmit={add}>
          <div className="flex flex-col gap-2">
            <label htmlFor="domain-hostname" className="text-sm font-medium text-ink">
              Add a domain
            </label>
            <input
              id="domain-hostname"
              className={`${inputClass} font-mono`}
              placeholder="api.example.com"
              value={hostname}
              onChange={(event) => setHostname(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="domain-port" className="text-sm font-medium text-ink">
              Port your application listens on
            </label>
            <input
              id="domain-port"
              className={`${inputClass} font-mono`}
              placeholder="3000"
              value={port}
              onChange={(event) => setPort(event.target.value)}
            />
            {/* The public reaches it on 443 regardless. Saying so here is what
                stops an Operator publishing 3000 to the internet to "make it
                work", which is the thing this replaces. */}
            <Text variant="caption" tone="secondary">
              The port inside the container. Visitors always arrive on https, whatever this is, so
              you do not need to publish it.
            </Text>
          </div>
          <div>
            <Button type="submit" disabled={busy || hostname.trim() === ''}>
              {busy ? 'Adding' : 'Add domain'}
            </Button>
          </div>
        </form>
      ) : null}

      <ConfirmDialog
        open={removing !== null}
        title={removing ? `Stop serving ${removing.hostname}?` : ''}
        description="This Service stops answering on that name and the name becomes free to use again. Nothing else on the server changes, and no DNS record is touched, so you may want to remove the record at your registrar too."
        confirmLabel="Stop serving it"
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          const target = removing;
          setRemoving(null);
          if (target) {
            void run(() => removeDomain(target.id));
          }
        }}
      />
    </Section>
  );
}

/** One hostname: where it has got to, and the one thing to do next. */
function DomainRow({
  domain,
  canWrite,
  busy,
  onVerify,
  onProvision,
  onRemove,
}: {
  domain: Domain;
  canWrite: boolean;
  busy: boolean;
  onVerify: () => void;
  onProvision: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-border px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        {domain.serving ? (
          <Check width={16} height={16} className="shrink-0 text-success" aria-hidden />
        ) : domain.state === 'failed' ? (
          <AlertTriangle width={16} height={16} className="shrink-0 text-danger" aria-hidden />
        ) : null}
        <div className="min-w-0 flex-1">
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
          <Text variant="caption" tone="secondary" className="block">
            {domain.state_detail}
          </Text>
        </div>
        {canWrite ? (
          <div className="flex items-center gap-2">
            {waitingOnDNS(domain) ? (
              <Button variant="ghost" size="sm" disabled={busy} onClick={onVerify}>
                <RefreshCw width={15} height={15} aria-hidden />
                Check DNS
              </Button>
            ) : null}
            {domain.state === 'dns_verified' || domain.state === 'failed' ? (
              <Button size="sm" disabled={busy} onClick={onProvision}>
                Put it live
              </Button>
            ) : null}
            <Button variant="ghost" size="sm" disabled={busy} onClick={onRemove}>
              Remove
            </Button>
          </div>
        ) : null}
      </div>

      {domain.last_error ? (
        <Text variant="caption" tone="secondary">
          {domain.last_error}
        </Text>
      ) : null}

      {waitingOnDNS(domain) ? <RecordToCreate domain={domain} /> : null}
    </div>
  );
}

/**
 * The record to create, ready to copy.
 *
 * Each part is copyable on its own because that is how a registrar's form is
 * filled in: three fields, one at a time. Offering only the whole thing as prose
 * is what makes somebody paste a hostname into a field that wants a label.
 */
function RecordToCreate({ domain }: { domain: Domain }) {
  const fields = [
    { label: 'Type', value: domain.record.type },
    { label: 'Name', value: domain.record.name },
    { label: 'Value', value: domain.record.value },
    { label: 'TTL', value: domain.record.ttl },
  ];
  return (
    <div className="rounded-md border border-border bg-subtle px-3 py-2">
      <Text variant="caption" tone="secondary" className="block">
        Create this record with whoever manages DNS for this domain, then check again. Changes can
        take a while to spread.
      </Text>
      <dl className="mt-2 flex flex-col gap-1">
        {fields.map((field) => (
          <div key={field.label} className="flex items-center gap-2">
            <dt className="w-16 shrink-0 text-sm text-ink-muted">{field.label}</dt>
            <dd className="min-w-0 flex-1 truncate font-mono text-sm text-ink">{field.value}</dd>
            <CopyButton value={field.value} label={`Copy the ${field.label.toLowerCase()}`} />
          </div>
        ))}
      </dl>
      {domain.dns_observed ? (
        <Text variant="caption" tone="secondary" className="mt-2 block">
          Currently resolves to {domain.dns_observed}.
        </Text>
      ) : null}
    </div>
  );
}
