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
import {
  AlertTriangle,
  Globe,
  KeyRound,
  LayoutDashboard,
  Layers,
  Network,
  Plus,
  RefreshCw,
  Server,
  ShieldCheck,
  Stethoscope,
  Waypoints,
} from '@slideops/icons';
import { EmptyState, PageHeader, SearchBar, TabNav, Toolbar, type TabNavTab } from '@slideops/ui';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { activeRole, useCanWrite, useWorkspaceStore } from '../../store/workspace';
import {
  DOMAIN_STATES,
  certificateReading,
  dnsReading,
  filterDomains,
  groupDomains,
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
import { CloudflareConnections } from '../components/CloudflareConnections';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DomainRecordFields, StatusPill } from '../components/DomainStatus';
import { DomainsByService } from '../components/DomainsByService';
import { DomainsCertificates } from '../components/DomainsCertificates';
import { DomainsDiagnostics } from '../components/DomainsDiagnostics';
import { DomainsDNSRecords } from '../components/DomainsDNSRecords';
import { DomainsOverview } from '../components/DomainsOverview';
import { ErrorNote, Loading } from '../components/Feedback';
import { OperatorShell } from '../components/OperatorShell';
import { ServerDomains } from '../components/ServerDomains';
import { WorkspaceIngress } from '../components/WorkspaceIngress';
import { useAsyncData } from '../hooks/useAsyncData';

/*
 * Domains and DNS, in one place, organized by the question being asked rather
 * than by everything at once on one long page.
 *
 * This used to live in three separate screens: a Service's own tab for adding
 * one, a Node's page for routing drift, and a networking page for the
 * credential and the entry point. Each was a reasonable place for one part of
 * the question and none of them could answer it alone, because a hostname
 * that is not working is a chain and the broken link is rarely on the page
 * you started from. Bringing them together into one long page fixed that but
 * traded it for a different problem: Cloudflare credentials, Server Domains,
 * Service hostnames, certificates, DNS records and routing all competing for
 * the same scroll.
 *
 * So the concerns stay separated, as tabs on one screen rather than one page
 * or several different screens: Overview for the state of the whole thing at
 * a glance, Services and Servers for the two relationships a hostname sits
 * inside (which Service it belongs to, and which Server Domain namespace it
 * was claimed under), Domains for the actual management of a hostname's
 * lifecycle, Cloudflare for the credential alone, DNS and Certificates for
 * their own state read across every hostname at once, Routing for the
 * entry-point mechanism, and Diagnostics for the four-state health check and
 * the routes-drift reconciliation that has no per-hostname equivalent.
 * Nothing here decides anything on its own: every call that touches a server
 * is behind a button that says what it will do first, and a tab switch only
 * changes what is being read.
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

const DOMAIN_TABS: TabNavTab[] = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'services', label: 'Services', icon: Layers },
  { key: 'servers', label: 'Servers', icon: Server },
  { key: 'domains', label: 'Domains', icon: Globe },
  { key: 'cloudflare', label: 'Cloudflare', icon: KeyRound },
  { key: 'dns', label: 'DNS', icon: Network },
  { key: 'certificates', label: 'Certificates', icon: ShieldCheck },
  { key: 'routing', label: 'Routing', icon: Waypoints },
  { key: 'diagnostics', label: 'Diagnostics', icon: Stethoscope },
];

export function Domains() {
  const canWrite = useCanWrite();
  const workspaces = useWorkspaceStore((state) => state.workspaces);
  const role = activeRole(workspaces);
  const canAdminister = role === 'owner' || role === 'admin';

  const [params, setParams] = useSearchParams();
  const data = useAsyncData<DomainsData>((signal) => loadDomains(signal), []);

  // A link from a Service or a Node's own page arrives expecting the filtered
  // list it always showed, not a summary: the default tab follows whichever
  // deep link brought someone here, and stays Overview otherwise.
  const defaultTab = params.has('service') || params.has('node') ? 'domains' : 'overview';
  const activeTab = DOMAIN_TABS.some((tab) => tab.key === params.get('tab'))
    ? (params.get('tab') as string)
    : defaultTab;
  const setActiveTab = (key: string) => {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (key === defaultTab) {
          next.delete('tab');
        } else {
          next.set('tab', key);
        }
        return next;
      },
      { replace: true },
    );
  };

  const [adding, setAdding] = useState(false);
  const [group, setGroup] = useState<GroupMode>('node');
  const [query, setQuery] = useState('');
  const [state, setState] = useState<DomainState | 'all'>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Domain | null>(null);

  // Deep links from a Service or a Node arrive with the id they came from, so
  // the Domains tab opens already narrowed to what the Operator was looking at.
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
        tabs={<TabNav tabs={DOMAIN_TABS} active={activeTab} onSelect={setActiveTab} />}
        actions={
          canWrite && !(adding && activeTab === 'domains') ? (
            <Button
              onClick={() => {
                setActiveTab('domains');
                setAdding(true);
              }}
            >
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
          {activeTab === 'overview' ? (
            <DomainsOverview domains={all} nodes={ready.nodes} onOpenTab={setActiveTab} />
          ) : null}

          {activeTab === 'services' ? (
            <DomainsByService
              services={ready.services}
              domains={all}
              nodeName={(id) => names.node.get(id ?? '') ?? 'Unknown server'}
            />
          ) : null}

          {activeTab === 'servers' ? (
            <Section
              title="Server Domains"
              flush
              adornment={<Server width={16} height={16} className="text-brand" aria-hidden />}
              description="A domain made available as a namespace for a server's Services to claim subdomains under, such as frc.mycompany.com. Adding one assigns it to nothing automatically: a Service still claims its own hostname from the Domains tab, optionally under one of these."
            >
              {ready.nodes.length === 0 ? (
                <Text variant="body-sm" tone="secondary">
                  No servers in this Workspace yet.
                </Text>
              ) : (
                <div className="flex flex-col gap-3">
                  {ready.nodes.map((node) => (
                    <ServerDomains
                      key={node.id}
                      node={node}
                      domains={all}
                      canAdminister={canAdminister}
                    />
                  ))}
                </div>
              )}
            </Section>
          ) : null}

          {activeTab === 'domains' ? (
            <>
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
                description="Central management for every hostname in this Workspace: add, correct, or remove one. Four separate things have to be true for a hostname to serve, and each is shown apart because they break apart."
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
                    The last refresh failed: {data.refreshError.message}. What is shown is the last
                    good read.
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
            </>
          ) : null}

          {activeTab === 'cloudflare' ? (
            <CloudflareConnections canAdminister={canAdminister} />
          ) : null}

          {activeTab === 'dns' ? (
            <DomainsDNSRecords domains={all} onChanged={data.reload} />
          ) : null}

          {activeTab === 'certificates' ? <DomainsCertificates domains={all} /> : null}

          {activeTab === 'routing' ? <WorkspaceIngress canAdminister={canAdminister} /> : null}

          {activeTab === 'diagnostics' ? (
            <DomainsDiagnostics domains={all} nodes={ready.nodes} onChanged={data.reload} />
          ) : null}
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
