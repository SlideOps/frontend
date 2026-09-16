import {
  getWorkspaceIngress,
  listDNSConnections,
  listServerDomains,
  type Domain,
  type DNSConnection,
  type Node,
  type ServerDomain,
  type WorkspaceIngressView,
} from '@slideops/api-client';
import { Section, Text } from '@slideops/design-system';
import { AlertTriangle, Check } from '@slideops/icons';
import { Link } from 'react-router-dom';
import { useAsyncData } from '../hooks/useAsyncData';

/*
 * The state of domains, DNS, certificates and routing, in one glance.
 *
 * This never becomes a second place to manage anything: every number here is
 * read from a tab that already owns the fact, and every link goes there
 * rather than opening a duplicate control on this page. What it adds is the
 * one thing none of those tabs can say on their own -- whether the Workspace
 * as a whole is in good shape, and if not, the short list of what to look at
 * first, so an Operator does not have to open all eight to find out.
 */

function SummaryCard({
  label,
  value,
  detail,
  tone,
  onOpen,
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: 'warn';
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex flex-col gap-1 rounded-md border border-border px-4 py-3 text-left transition-colors duration-fast ease-standard hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
    >
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
      <Text variant="h3">{value}</Text>
      {detail ? (
        <Text variant="caption" className={tone === 'warn' ? 'text-warning' : 'text-ink-muted'}>
          {detail}
        </Text>
      ) : null}
    </button>
  );
}

export function DomainsOverview({
  domains,
  nodes,
  onOpenTab,
}: {
  domains: Domain[];
  nodes: Node[];
  onOpenTab: (tab: string) => void;
}) {
  const connections = useAsyncData<DNSConnection[]>(() => listDNSConnections(), []);
  const ingress = useAsyncData<WorkspaceIngressView>(() => getWorkspaceIngress(), []);
  // No workspace-wide endpoint exists for this, so it is read the same way the
  // Servers tab reads it: once per server, gathered together.
  const nodeIds = nodes.map((node) => node.id).join(',');
  const serverDomains = useAsyncData<ServerDomain[]>(
    () => Promise.all(nodes.map((node) => listServerDomains(node.id))).then((lists) => lists.flat()),
    [nodeIds],
  );

  const connectionList = connections.state.status === 'ready' ? connections.state.data : [];
  const unusable = connectionList.filter((connection) => !connection.usable).length;
  const ingressData = ingress.state.status === 'ready' ? ingress.state.data : undefined;
  const serverDomainList = serverDomains.state.status === 'ready' ? serverDomains.state.data : [];

  const problems = domains.filter((domain) => !domain.serving);
  const shown = problems.slice(0, 6);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Domains"
          value={String(domains.length)}
          detail={`${domains.length - problems.length} of ${domains.length} serving`}
          onOpen={() => onOpenTab('domains')}
        />
        <SummaryCard
          label="Server Domains"
          value={String(serverDomainList.length)}
          detail="namespaces across your servers"
          onOpen={() => onOpenTab('servers')}
        />
        <SummaryCard
          label="Cloudflare"
          value={connectionList.length === 0 ? 'Not connected' : String(connectionList.length)}
          detail={
            unusable > 0
              ? `${unusable} ${unusable === 1 ? 'credential needs' : 'credentials need'} attention`
              : connectionList.length > 0
                ? 'All working'
                : 'A domain can still be added without one'
          }
          tone={unusable > 0 ? 'warn' : undefined}
          onOpen={() => onOpenTab('cloudflare')}
        />
        <SummaryCard
          label="Entry point"
          value={ingressData?.enabled ? 'One server' : 'Per Service'}
          detail={ingressData?.drifted ? 'Its address has changed' : undefined}
          tone={ingressData?.drifted ? 'warn' : undefined}
          onOpen={() => onOpenTab('routing')}
        />
      </div>

      <Section
        title="Needs attention"
        description="Hostnames not currently serving. Each fails for a different reason, so open one to see which and fix it there."
      >
        {problems.length === 0 ? (
          <div className="flex items-center gap-2">
            <Check width={16} height={16} className="shrink-0 text-success" aria-hidden />
            <Text variant="body-sm" tone="secondary">
              Every domain in this Workspace is serving.
            </Text>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {shown.map((domain) => (
              <div key={domain.id} className="flex flex-wrap items-center gap-3">
                <AlertTriangle width={15} height={15} className="shrink-0 text-warning" aria-hidden />
                <Link
                  to={`/app/domains/${domain.id}`}
                  className="min-w-0 truncate font-mono text-sm text-brand hover:underline"
                >
                  {domain.hostname}
                </Link>
                <Text variant="caption" tone="secondary" className="min-w-0 flex-1 truncate">
                  {domain.state_detail}
                </Text>
              </div>
            ))}
            {problems.length > shown.length ? (
              <button
                type="button"
                onClick={() => onOpenTab('diagnostics')}
                className="self-start text-sm font-medium text-brand hover:underline"
              >
                See all {problems.length} in Diagnostics
              </button>
            ) : null}
          </div>
        )}
      </Section>
    </div>
  );
}
