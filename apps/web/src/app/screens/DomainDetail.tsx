import {
  getDomain,
  listNodes,
  listServices,
  provisionDomain,
  removeDomain,
  updateDomain,
  verifyDomain,
  type ApiError,
  type Domain,
  type Node,
  type Service,
} from '@slideops/api-client';
import { Button, Card, Section, Text } from '@slideops/design-system';
import { AlertTriangle, ArrowLeft, ExternalLink, Pencil } from '@slideops/icons';
import { PageHeader } from '@slideops/ui';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useCanWrite } from '../../store/workspace';
import {
  certificateReading,
  dnsReading,
  remediationFor,
  routingReading,
  servingReading,
  stateLabel,
} from '../domain-status';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DomainRecordFields, StatusPill } from '../components/DomainStatus';
import { ErrorNote, Loading } from '../components/Feedback';
import { OperatorShell } from '../components/OperatorShell';
import { useAsyncData } from '../hooks/useAsyncData';

/*
 * One hostname, in full.
 *
 * The list answers "which of my domains is unhappy". It cannot answer "what is
 * this one actually doing", because a hostname is a chain of four separate
 * things and a row has room for four words. This page is where the chain is laid
 * out end to end, and where the parts of it that are a record rather than a
 * server can be corrected.
 *
 * Correcting the target is the reason this page exists at all. The port was set
 * once when a hostname was claimed and could never be changed, so an Operator who
 * typed the wrong one had a single way out: remove the hostname and add it again,
 * throwing away the DNS record already created at their registrar and the
 * certificate already issued, to fix a number. That is not an edge case, it is
 * what happens the first time anybody uses this.
 *
 * Saving a correction changes a record here and nothing on any server. The route
 * is rewritten by putting the domain live again, which is the same reviewed path
 * that wrote it in the first place. Until then the page says so plainly: the
 * server really is serving this hostname, and it really is serving the wrong
 * port, and an Operator needs to be told both rather than either one alone.
 */

const inputClass =
  'h-9 w-full rounded-md border border-border bg-surface px-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';

interface DetailData {
  domain: Domain;
  services: Service[];
  nodes: Node[];
}

export function DomainDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const canWrite = useCanWrite();

  const result = useAsyncData<DetailData>(async () => {
    // The domain is the page; the two lists only put names on ids. A failure
    // to read them must not take the page down with them.
    const domain = await getDomain(id);
    const [services, nodes] = await Promise.all([
      listServices().catch(() => [] as Service[]),
      listNodes().catch(() => [] as Node[]),
    ]);
    return { domain, services, nodes };
  }, [id]);

  if (result.state.status === 'loading') {
    return (
      <OperatorShell active="domains">
        <Loading label="Reading this domain" />
      </OperatorShell>
    );
  }
  if (result.state.status === 'error') {
    return (
      <OperatorShell active="domains">
        <BackLink />
        <ErrorNote error={result.state.error} />
      </OperatorShell>
    );
  }

  const { domain, services, nodes } = result.state.data;
  const service = services.find((candidate) => candidate.id === domain.service_id);
  const node = nodes.find((candidate) => candidate.id === domain.node_id);

  return (
    <OperatorShell active="domains">
      <BackLink />
      <PageHeader
        title={domain.hostname}
        description={
          service
            ? `Points at ${service.name}${node ? ` on ${node.name}` : ''}.`
            : 'Points at a Service that could not be read.'
        }
        actions={
          <a
            href={domain.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline"
          >
            Open {domain.url}
            <ExternalLink width={14} height={14} aria-hidden />
          </a>
        }
      />

      {domain.needs_reapply ? (
        <OutOfDateBanner domain={domain} canWrite={canWrite} onApplied={result.reload} />
      ) : null}

      <Section title="Where it has got to" description={stateLabel(domain.state)}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatusPill reading={dnsReading(domain)} label="DNS" />
          <StatusPill reading={certificateReading(domain)} label="Certificate" />
          <StatusPill reading={routingReading(domain)} label="Routing" />
          <StatusPill reading={servingReading(domain)} label="Serving" />
        </div>
        {domain.last_error ? (
          <Card className="mt-3 border-danger">
            <Text variant="body-sm" tone="secondary">
              {domain.last_error}
            </Text>
          </Card>
        ) : null}
      </Section>

      <TargetSection
        domain={domain}
        service={service}
        node={node}
        canWrite={canWrite}
        onSaved={result.reload}
      />

      <Section
        title="The DNS record"
        description="What to create at your registrar, exactly as it should be entered."
      >
        <Card>
          <DomainRecordFields domain={domain} />
        </Card>
      </Section>

      <Actions
        domain={domain}
        canWrite={canWrite}
        onChanged={result.reload}
        onRemoved={() => navigate('/app/domains')}
      />
    </OperatorShell>
  );
}

function BackLink() {
  return (
    <Link
      to="/app/domains"
      className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-ink-muted hover:text-ink"
    >
      <ArrowLeft width={14} height={14} aria-hidden />
      All domains
    </Link>
  );
}

/**
 * The server is serving, and it is serving the wrong thing.
 *
 * Both halves are true at once after a correction, and reporting only one of
 * them is what sends an Operator looking for a fault that is not there. It says
 * which port each side holds, because "out of date" without the two numbers is
 * a feeling rather than a fact.
 */
function OutOfDateBanner({
  domain,
  canWrite,
  onApplied,
}: {
  domain: Domain;
  canWrite: boolean;
  onApplied: () => void;
}) {
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const apply = async () => {
    setApplying(true);
    setError(null);
    try {
      await provisionDomain(domain.id);
      onApplied();
    } catch (caught) {
      setError(caught as ApiError);
    } finally {
      setApplying(false);
    }
  };

  return (
    <Card className="mb-4 border-warning">
      <div className="flex flex-wrap items-start gap-3">
        <AlertTriangle
          width={18}
          height={18}
          className="mt-0.5 shrink-0 text-warning"
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <Text variant="body-sm" className="font-medium">
            This change is not live yet
          </Text>
          <Text variant="body-sm" tone="secondary" className="mt-1 block">
            The server is still routing {domain.hostname} to port{' '}
            <span className="font-mono">{domain.provisioned_port}</span>. The record now says port{' '}
            <span className="font-mono">{domain.target_port}</span>. Applying rewrites the route for
            this hostname only. Your DNS record and certificate are untouched.
          </Text>
          {error ? <ErrorNote error={error} /> : null}
        </div>
        {canWrite ? (
          <Button size="sm" onClick={apply} disabled={applying}>
            {applying ? 'Applying' : 'Apply the change'}
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

/** Where the hostname points, and the one part of it that can be corrected. */
function TargetSection({
  domain,
  service,
  node,
  canWrite,
  onSaved,
}: {
  domain: Domain;
  service?: Service;
  node?: Node;
  canWrite: boolean;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <Section
      title="Where it points"
      description="Inside the Service. Visitors always reach it on 443; this is the port your application itself listens on."
      action={
        canWrite && !editing ? (
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
            <Pencil width={14} height={14} aria-hidden />
            Edit
          </Button>
        ) : null
      }
    >
      <Card>
        {editing ? (
          <TargetForm
            domain={domain}
            onCancel={() => setEditing(false)}
            onSaved={() => {
              setEditing(false);
              onSaved();
            }}
          />
        ) : (
          <dl className="grid gap-3 sm:grid-cols-2">
            <Field label="Service" value={service ? service.name : domain.service_id} />
            <Field label="Server" value={node ? node.name : (domain.node_id ?? 'Not assigned')} />
            <Field label="Port" value={String(domain.target_port)} mono />
            <Field label="Proxy speaks" value={domain.target_scheme} mono />
          </dl>
        )}
      </Card>
    </Section>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className={`mt-0.5 truncate text-sm text-ink${mono ? ' font-mono' : ''}`}>{value}</dd>
    </div>
  );
}

/**
 * Correcting the target.
 *
 * The hostname is deliberately not here. A different hostname is a different
 * hostname, with its own DNS record and its own certificate; offering it as a
 * text field would imply SlideOps can rename one, and what it would actually do
 * is leave the old name still routed on the server with nothing recording that.
 */
function TargetForm({
  domain,
  onCancel,
  onSaved,
}: {
  domain: Domain;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [port, setPort] = useState(String(domain.target_port));
  const [scheme, setScheme] = useState<'http' | 'https'>(domain.target_scheme);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const parsed = Number(port);
  const portValid = Number.isInteger(parsed) && parsed >= 1 && parsed <= 65535;

  const save = async () => {
    if (!portValid) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateDomain(domain.id, { port: parsed, scheme });
      onSaved();
    } catch (caught) {
      setError(caught as ApiError);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-ink-muted">Port</span>
          <input
            className={inputClass}
            value={port}
            inputMode="numeric"
            onChange={(event) => setPort(event.target.value)}
            aria-invalid={portValid ? undefined : true}
            aria-label="The port your application listens on"
          />
          <span className="text-xs text-ink-muted">
            The port your application listens on inside the Service, such as 8080.
          </span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-ink-muted">Proxy speaks</span>
          <select
            className={inputClass}
            value={scheme}
            onChange={(event) => setScheme(event.target.value as 'http' | 'https')}
            aria-label="How the proxy speaks to your application"
          >
            <option value="http">http</option>
            <option value="https">https</option>
          </select>
          <span className="text-xs text-ink-muted">
            Almost always http. Visitors still reach the site over https; only the hop from the
            proxy to your application is plain, and it never leaves the server.
          </span>
        </label>
      </div>

      {!portValid ? (
        <Text variant="body-sm" tone="secondary">
          A port is a whole number between 1 and 65535.
        </Text>
      ) : null}
      {error ? <ErrorNote error={error} /> : null}

      <Text variant="body-sm" tone="secondary">
        Saving records the change. Nothing on the server changes until you apply it, and this page
        will say so until you do.
      </Text>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={save} disabled={saving || !portValid}>
          {saving ? 'Saving' : 'Save'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

/** Everything that acts on this hostname, each saying what it does first. */
function Actions({
  domain,
  canWrite,
  onChanged,
  onRemoved,
}: {
  domain: Domain;
  canWrite: boolean;
  onChanged: () => void;
  onRemoved: () => void;
}) {
  const [busy, setBusy] = useState<null | 'verify' | 'provision' | 'remove'>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  // The banner above already offers this exact action when a correction is
  // waiting, and two buttons that do the same thing on one page is a question
  // about which one is the real one.
  const remediation = domain.needs_reapply ? null : remediationFor(domain);

  const run = async (kind: 'verify' | 'provision') => {
    setBusy(kind);
    setError(null);
    try {
      await (kind === 'verify' ? verifyDomain(domain.id) : provisionDomain(domain.id));
      onChanged();
    } catch (caught) {
      setError(caught as ApiError);
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    setBusy('remove');
    setError(null);
    try {
      await removeDomain(domain.id);
      onRemoved();
    } catch (caught) {
      setError(caught as ApiError);
      setBusy(null);
    }
  };

  if (!canWrite) {
    return (
      <Section title="What you can do">
        <Text variant="body-sm" tone="secondary">
          Changing a domain needs a role above Viewer in this workspace.
        </Text>
      </Section>
    );
  }

  return (
    <Section title="What you can do">
      <Card className="flex flex-col gap-3">
        {remediation ? (
          <div className="flex flex-wrap items-start justify-between gap-3">
            <Text variant="body-sm" tone="secondary" className="min-w-0 flex-1">
              {remediation.explanation}
            </Text>
            <Button size="sm" onClick={() => run(remediation.kind)} disabled={busy !== null}>
              {busy === remediation.kind ? 'Working' : remediation.label}
            </Button>
          </div>
        ) : (
          <Text variant="body-sm" tone="secondary">
            {domain.needs_reapply
              ? 'The change you saved is waiting to be applied, above.'
              : 'Nothing needs doing. This hostname is serving.'}
          </Text>
        )}

        {error ? <ErrorNote error={error} /> : null}

        <div className="flex flex-wrap gap-2 border-t border-border pt-3">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => run('verify')}
            disabled={busy !== null}
          >
            Check DNS now
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => setConfirmingRemove(true)}
            disabled={busy !== null}
          >
            Remove this domain
          </Button>
        </div>
      </Card>

      <ConfirmDialog
        open={confirmingRemove}
        title={`Remove ${domain.hostname}?`}
        description={
          'This stops SlideOps serving this hostname and releases the name. Only this hostname\u2019s own route is removed: every other site on the same server keeps working, and no DNS record is touched. ' +
          'If the port is simply wrong, close this and use Edit instead, which keeps your DNS record and your certificate.'
        }
        confirmLabel="Remove it"
        confirmVariant="danger"
        onConfirm={() => {
          setConfirmingRemove(false);
          void remove();
        }}
        onCancel={() => setConfirmingRemove(false)}
      />
    </Section>
  );
}
