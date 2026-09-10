import {
  ApiError,
  listNodes,
  listServices,
  listWorkspaceDomains,
  provisionDomain,
  removeDomain,
  verifyDomain,
  type Domain,
  type DomainState,
  type Node,
  type Service,
} from '@slideops/api-client';
import { Button, Section, Text } from '@slideops/design-system';
import { AlertTriangle, Globe, Network, Plus, RefreshCw } from '@slideops/icons';
import { EmptyState, PageHeader, SearchBar, Toolbar } from '@slideops/ui';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { activeRole, useCanWrite, useWorkspaceStore } from '../../store/workspace';
import {
  DOMAIN_STATES,
  certificateReading,
  dnsReading,
  filterDomains,
  groupDomains,
  nodeIdsWithDomains,
  nodeNameOf,
  remediationFor,
  routingReading,
  serviceNameOf,
  servingReading,
  stateLabel,
  type DomainFilter,
  type DomainNames,
  type GroupMode,
} from '../domain-status';
import { AddDomainStepper } from '../components/AddDomainStepper';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DomainRecordFields, StatusPill } from '../components/DomainStatus';
import { DomainRouting } from '../components/DomainRouting';
import { ErrorNote, Loading } from '../components/Feedback';
import { OperatorShell } from '../components/OperatorShell';
import { RoutingDrift } from '../components/RoutingDrift';
import { useAsyncData } from '../hooks/useAsyncData';

/*
 * Domains and DNS, in one place.
 *
 * This used to live in three: a Service's own tab for adding one, a Node's page
 * for routing drift, and a networking page for the credential and the entry
 * point. Each was a reasonable place for one part of the question and none of
 * them could answer it, because a hostname that is not working is a chain and
 * the broken link is rarely on the page you started from.
 *
 * So the whole chain is here, per hostname, side by side: what DNS answers, what
 * the certificate is doing, whether the route exists, and whether a visitor
 * actually reaches the application. They stay four columns and never collapse
 * into one word, because they fail separately and each has a different fix.
 *
 * Nothing here decides anything on its own. Every call that touches a server is
 * behind a button that says what it will do first, and a page load only reads.
 */

const inputClass =
  'h-9 rounded-md border border-border bg-surface px-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';

interface DomainsData {
  domains: Domain[];
  services: Service[];
  nodes: Node[];
}

/**
 * The overview feed, plus the two lists it has to be joined against.
 *
 * A domain carries a service_id and a node_id and no names, so the names are
 * joined here. A failure to read Services or Nodes is not a failure to read
 * domains: the list still renders and the unresolved ids read as unknown rather
 * than taking the page down with them.
 */
async function loadDomains(signal: AbortSignal): Promise<DomainsData> {
  const [domains, services, nodes] = await Promise.all([
    listWorkspaceDomains(),
    listServices(signal).catch(() => [] as Service[]),
    listNodes(signal).catch(() => [] as Node[]),
  ]);
  return { domains, services, nodes };
}

export function Domains() {
  const canWrite = useCanWrite();
  const workspaces = useWorkspaceStore((state) => state.workspaces);
  const role = activeRole(workspaces);
  const canAdminister = role === 'owner' || role === 'admin';

  const [params, setParams] = useSearchParams();
  const data = useAsyncData<DomainsData>((signal) => loadDomains(signal), []);

  const [adding, setAdding] = useState(false);
  const [group, setGroup] = useState<GroupMode>('node');
  const [query, setQuery] = useState('');
  const [state, setState] = useState<DomainState | 'all'>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Domain | null>(null);

  // Deep links from a Service or a Node arrive with the id they came from, so
  // the page opens already narrowed to what the Operator was looking at.
  const nodeId = params.get('node') ?? 'all';
  const serviceId = params.get('service') ?? 'all';

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value === 'all') {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    setParams(next, { replace: true });
  };

  const ready = data.state.status === 'ready' ? data.state.data : undefined;

  const names: DomainNames = useMemo(
    () => ({
      service: new Map((ready?.services ?? []).map((service) => [service.id, service.name])),
      node: new Map((ready?.nodes ?? []).map((node) => [node.id, node.name])),
    }),
    [ready],
  );

  const filter: DomainFilter = { query, state, nodeId, serviceId };
  const all = ready?.domains ?? [];
  const shown = filterDomains(all, filter, names);
  const groups = groupDomains(shown, group, names);

  const run = async (domain: Domain, action: () => Promise<unknown>) => {
    setBusyId(domain.id);
    setActionError(null);
    try {
      await action();
      data.reload();
    } catch (caught) {
      // The backend's message, unedited. It is the only thing that knows why,
      // and "that did not work" would send somebody to a terminal to find out.
      setActionError(caught instanceof ApiError ? caught.message : 'That did not work. Try again.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <OperatorShell active="domains">
      <PageHeader
        title="Domains and DNS"
        description="Every hostname in this Workspace, what it points at, and which part of the chain is not working. Domains belong to Services, so one server can answer for as many of them as it runs."
        guidanceKey="domains.overview"
        actions={
          canWrite && !adding ? (
            <Button onClick={() => setAdding(true)}>
              <Plus width={16} height={16} aria-hidden />
              Add a domain
            </Button>
          ) : undefined
        }
      />

      {data.state.status === 'loading' ? <Loading label="Loading your domains" /> : null}
      {data.state.status === 'error' ? <ErrorNote error={data.state.error} /> : null}

      {ready ? (
        <div className="flex flex-col gap-8">
          {adding ? (
            <AddDomainStepper
              services={ready.services}
              nodes={ready.nodes}
              onCancel={() => setAdding(false)}
              onFinished={() => {
                setAdding(false);
                data.reload();
              }}
            />
          ) : null}

          <Section
            title="Your domains"
            flush
            adornment={<Globe width={16} height={16} className="text-brand" aria-hidden />}
            description="Four separate things have to be true for a hostname to serve: DNS answers with the right target, the route exists on the server, a certificate was issued, and the Service is answering. They are shown apart because they break apart."
            action={
              <Button variant="ghost" size="sm" onClick={() => data.reload()}>
                <RefreshCw width={15} height={15} aria-hidden />
                {data.refreshing ? 'Refreshing' : 'Refresh'}
              </Button>
            }
          >
            <Toolbar>
              <SearchBar
                value={query}
                onChange={setQuery}
                label="Search domains"
                placeholder="Search by hostname, Service, or server"
              />
              <label className="flex items-center gap-2 text-sm text-ink-muted">
                Group by
                <select
                  className={inputClass}
                  aria-label="Group by"
                  value={group}
                  onChange={(event) => setGroup(event.target.value as GroupMode)}
                >
                  <option value="node">Server</option>
                  <option value="service">Service</option>
                  <option value="status">Status</option>
                  <option value="none">Nothing</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm text-ink-muted">
                Status
                <select
                  className={inputClass}
                  aria-label="Filter by status"
                  value={state}
                  onChange={(event) => setState(event.target.value as DomainState | 'all')}
                >
                  <option value="all">Any status</option>
                  {DOMAIN_STATES.map((candidate) => (
                    <option key={candidate} value={candidate}>
                      {stateLabel(candidate)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm text-ink-muted">
                Server
                <select
                  className={inputClass}
                  aria-label="Filter by server"
                  value={nodeId}
                  onChange={(event) => setParam('node', event.target.value)}
                >
                  <option value="all">Any server</option>
                  {ready.nodes.map((node) => (
                    <option key={node.id} value={node.id}>
                      {node.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm text-ink-muted">
                Service
                <select
                  className={inputClass}
                  aria-label="Filter by Service"
                  value={serviceId}
                  onChange={(event) => setParam('service', event.target.value)}
                >
                  <option value="all">Any Service</option>
                  {ready.services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name}
                    </option>
                  ))}
                </select>
              </label>
            </Toolbar>

            {data.refreshError ? (
              <Text variant="caption" tone="secondary">
                The last refresh failed: {data.refreshError.message}. What is shown is the last good
                read.
              </Text>
            ) : null}

            {actionError ? (
              <p role="alert" className="text-sm text-danger">
                {actionError}
              </p>
            ) : null}

            {all.length === 0 ? (
              <EmptyState
                icon={Globe}
                title="No domains in this Workspace yet"
                description="A domain makes a Service reachable at a name instead of an address and a port, on https, without publishing anything to the internet by hand."
                action={
                  canWrite ? (
                    <Button onClick={() => setAdding(true)}>Add your first domain</Button>
                  ) : undefined
                }
              />
            ) : shown.length === 0 ? (
              <Text variant="body-sm" tone="secondary">
                No domain matches those filters. {all.length} in this Workspace altogether.
              </Text>
            ) : (
              <div className="flex flex-col gap-6">
                {groups.map((entry) => (
                  <div key={entry.key} className="flex flex-col gap-2">
                    {group === 'none' ? null : (
                      <div className="flex flex-wrap items-baseline gap-2">
                        <Text as="h3" variant="body-sm" className="font-medium">
                          {entry.label}
                        </Text>
                        <Text variant="caption" tone="secondary">
                          {entry.domains.length}{' '}
                          {entry.domains.length === 1 ? 'domain' : 'domains'}
                        </Text>
                      </div>
                    )}
                    {entry.domains.map((domain) => (
                      <DomainCard
                        key={domain.id}
                        domain={domain}
                        serviceName={serviceNameOf(domain, names)}
                        nodeName={nodeNameOf(domain, names)}
                        canWrite={canWrite}
                        busy={busyId === domain.id}
                        onVerify={() => run(domain, () => verifyDomain(domain.id))}
                        onProvision={() => run(domain, () => provisionDomain(domain.id))}
                        onRemove={() => setRemoving(domain)}
                      />
                    ))}
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section
            title="Routing on your servers"
            adornment={<Network width={16} height={16} className="text-brand" aria-hidden />}
            description="What each server is actually serving, checked against the domains SlideOps put on it. Read only until you press something."
          >
            {nodeIdsWithDomains(all).length === 0 ? (
              <Text variant="body-sm" tone="secondary">
                No domain is attached to a server yet, so there is no routing to check.
              </Text>
            ) : (
              <div className="flex flex-col gap-3">
                {nodeIdsWithDomains(all).map((id) => (
                  <RoutingDrift
                    key={id}
                    nodeId={id}
                    nodeName={names.node.get(id) ?? 'Unknown server'}
                  />
                ))}
              </div>
            )}
          </Section>

          {/* The credential and the entry point live here rather than on the
              networking page, because somebody setting up their first domain
              meets all three in one sitting and splitting them made that one
              journey into two. */}
          <DomainRouting canAdminister={canAdminister} />
        </div>
      ) : null}

      <ConfirmDialog
        open={removing !== null}
        title={removing ? `Stop serving ${removing.hostname}?` : ''}
        description="The Service stops answering on that name and the name becomes free to use again. Only this hostname's own route is removed, so every other site on the same server keeps working, and no DNS record is touched: you may want to remove the record at your registrar too."
        confirmLabel="Stop serving it"
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          const target = removing;
          setRemoving(null);
          if (target) {
            void run(target, () => removeDomain(target.id));
          }
        }}
      />
    </OperatorShell>
  );
}

/** One hostname: the whole chain behind it, and the one thing to do next. */
function DomainCard({
  domain,
  serviceName,
  nodeName,
  canWrite,
  busy,
  onVerify,
  onProvision,
  onRemove,
}: {
  domain: Domain;
  serviceName: string;
  nodeName: string;
  canWrite: boolean;
  busy: boolean;
  onVerify: () => void;
  onProvision: () => void;
  onRemove: () => void;
}) {
  const remediation = remediationFor(domain);
  const waitingOnDNS = domain.state === 'pending_dns' || domain.state === 'dns_verifying';

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border px-4 py-3">
      <div className="flex flex-wrap items-start gap-3">
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
          {/* Which Service a hostname belongs to is the fact this page exists to
              make obvious, so it is on the row rather than a click away. */}
          <Text variant="caption" tone="secondary" className="mt-0.5 block">
            <Link to={`/app/services/${domain.service_id}`} className="underline">
              {serviceName}
            </Link>{' '}
            on {nodeName}, port {domain.target_port}
          </Text>
          <Text variant="caption" tone="secondary" className="mt-0.5 block">
            {domain.state_detail}
          </Text>
          {/* A correction that has not been applied is the one thing on this row
              that a state word cannot say, because the hostname really is
              serving: it is serving the old port. */}
          {domain.needs_reapply ? (
            <Text variant="caption" className="mt-0.5 block text-warning">
              Still routing to port {domain.provisioned_port}. Open it to apply the change.
            </Text>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {/* The way into everything a row has no space for, and the only place
              the port can be corrected without giving up the hostname. */}
          <Link
            to={`/app/domains/${domain.id}`}
            className="text-sm font-medium text-brand hover:underline"
          >
            Open
          </Link>
          {canWrite ? (
            <Button variant="ghost" size="sm" disabled={busy} onClick={onRemove}>
              Remove
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-x-8 gap-y-3">
        <StatusPill label="DNS" reading={dnsReading(domain)} />
        <StatusPill label="Routing" reading={routingReading(domain)} />
        <StatusPill label="Certificate" reading={certificateReading(domain)} />
        <StatusPill label="Serving" reading={servingReading(domain)} />
      </div>

      {domain.last_error ? (
        <div className="flex items-start gap-2">
          <AlertTriangle width={15} height={15} className="mt-0.5 shrink-0 text-danger" aria-hidden />
          <Text variant="caption" tone="secondary">
            {domain.last_error}
          </Text>
        </div>
      ) : null}

      {waitingOnDNS ? (
        <div className="rounded-md border border-border bg-subtle px-3 py-2">
          <Text variant="caption" tone="secondary" className="block">
            Create this record with whoever manages DNS for {domain.hostname}, then check again.
            Changes take a while to spread.
          </Text>
          <div className="mt-2">
            <DomainRecordFields domain={domain} />
          </div>
        </div>
      ) : null}

      {remediation && canWrite ? (
        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
          <Text variant="caption" tone="secondary" className="min-w-0 flex-1">
            {remediation.explanation}
          </Text>
          <Button
            size="sm"
            disabled={busy}
            onClick={remediation.kind === 'verify' ? onVerify : onProvision}
          >
            {busy ? 'Working' : remediation.label}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
