import {
  serviceShellUrl,
  ApiError,
  cancelServiceDeploy,
  getNode,
  getProject,
  getService,
  redeployService,
  removeService,
  restartService,
  startService,
  stopService,
  type Node,
  type Project,
  type Service,
} from '@slideops/api-client';
import { Button, Card, Text, Section } from '@slideops/design-system';
import {
  ArrowLeft,
  Database,
  FileText,
  Play,
  RefreshCw,
  Server,
  serviceIcon,
  Settings as SettingsIcon,
  Square,
  Terminal as TerminalIcon,
  Trash2,
  XCircle,
} from '@slideops/icons';
import { Guidance } from '@slideops/tooltips';
import { DetailLayout, PageHeader, TabNav, type TabNavTab } from '@slideops/ui';
import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useCanWrite } from '../../store/workspace';
import { ServiceStatusBadge } from '../components/Badges';
import { ErrorNote, Loading } from '../components/Feedback';
import { OperatorShell } from '../components/OperatorShell';
import { ServiceMetricsPanel } from '../components/ServiceMetrics';
import { ServiceEndpoint } from '../components/ServiceEndpoint';
import { CapabilityManagement } from '../components/CapabilityManagement';
import {
  DatabaseExplorer,
  DATABASE_EXPLORER_ACTION_KEYS,
} from '../components/DatabaseExplorer';
import { ServiceActivityTrail } from '../components/ServiceActivity';
import { ServiceLogView } from '../components/ServiceLogView';
import { ShellTerminal } from '../components/ShellTerminal';
import { ServicePreview } from '../components/ServicePreview';
import { ServiceResourcesPanel } from '../components/ServiceResourcesPanel';
import { ServiceConfiguration } from '../components/ServiceConfiguration';
import { ServiceUpdatePanel } from '../components/ServiceUpdatePanel';
import { useAsyncData } from '../hooks/useAsyncData';

interface DetailData {
  service: Service;
  project: Project | null;
  node: Node | null;
}

const POLL_MS = 3000;

async function loadDetail(id: string, signal: AbortSignal): Promise<DetailData> {
  const service = await getService(id, signal);
  const [project, node] = await Promise.all([
    getProject(service.project_id, signal).catch(() => null),
    getNode(service.node_id, signal).catch(() => null),
  ]);
  return { service, project, node };
}

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-2 sm:grid-cols-[8rem_1fr] sm:gap-3">
      <dt className="text-xs font-medium text-ink-muted">{label}</dt>
      <dd className="min-w-0 break-words text-sm text-ink">{children}</dd>
    </div>
  );
}

/** Format a memory reading in MB, stepping up to GB once it is large. */
function memory(mb: number): string {
  if (mb >= 1024) {
    const gb = mb / 1024;
    return `${Number.isInteger(gb) ? gb : gb.toFixed(1)} GB`;
  }
  return `${mb} MB`;
}

function sourceText(service: Service): string {
  // An adopted workload was already running when SlideOps found it, so there is
  // no source it was built from here; the image is shown when the runtime
  // reported one, and otherwise the plain fact.
  if (service.source.type === 'adopted') {
    return service.source.image
      ? `${service.source.image} (already running when SlideOps found it)`
      : 'Already running when SlideOps found it';
  }
  if (service.source.type === 'image') {
    return service.source.image ?? 'Image';
  }
  return service.source.repository_url ?? 'Repository';
}


/*
 * Logs and activity, together, on their own tab.
 *
 * They answer one question between them and neither answers it alone: the output
 * says the application is unhappy, and the trail says what changed just before it
 * became unhappy. Splitting them across the page meant reading one, scrolling,
 * and trying to hold the other in your head.
 */
function LogsAndActivity({ id }: { id: string }) {
  const [tab, setTab] = useState<'logs' | 'activity'>('logs');

  return (
    <Section title="Logs and activity" adornment={<Guidance for="service.logs" />} flush>
      <div
        role="tablist"
        aria-label="What to show"
        className="flex w-fit gap-1 rounded-md border border-border p-1"
      >
        {(
          [
            ['logs', 'Output'],
            ['activity', 'Activity'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={`rounded px-3 py-1 text-sm transition-colors duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
              tab === value ? 'bg-subtle font-medium text-ink' : 'text-ink-muted hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'logs' ? <ServiceLogView id={id} /> : <ServiceActivityTrail id={id} />}
    </Section>
  );
}

const SERVICE_TABS: TabNavTab[] = [
  { key: 'overview', label: 'Overview', icon: Server },
  { key: 'browse', label: 'Browse', icon: Database },
  { key: 'shell', label: 'Shell', icon: TerminalIcon },
  { key: 'logs', label: 'Logs', icon: FileText },
  { key: 'settings', label: 'Settings', icon: SettingsIcon },
];
const DEFAULT_SERVICE_TAB = 'overview';

/** The Service detail: summary, live metrics, lifecycle actions, and logs. */
export function ServiceDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const canWrite = useCanWrite();
  const { state, reload } = useAsyncData((signal) => loadDetail(id, signal), [id]);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = SERVICE_TABS.some((tab) => tab.key === searchParams.get('tab'))
    ? (searchParams.get('tab') as string)
    : DEFAULT_SERVICE_TAB;
  const setActiveTab = (key: string) => {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (key === DEFAULT_SERVICE_TAB) {
          next.delete('tab');
        } else {
          next.set('tab', key);
        }
        return next;
      },
      { replace: true },
    );
  };

  const [actionError, setActionError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  // A resize applies live, so reflect the new limits at once without a jarring
  // full refetch. This override is cleared whenever the Service being viewed changes.
  const [resized, setResized] = useState<Pick<
    Service,
    'cpu_limit' | 'memory_mb' | 'pids_limit'
  > | null>(null);

  useEffect(() => {
    setResized(null);
  }, [id]);

  const baseService = state.status === 'ready' ? state.data.service : null;
  const service = baseService && resized ? { ...baseService, ...resized } : baseService;
  const status = service?.status;

  // While a Service is deploying, poll until it settles at running or failed.
  useEffect(() => {
    if (status !== 'deploying') {
      return;
    }
    const timer = setTimeout(() => reload(), POLL_MS);
    return () => clearTimeout(timer);
  }, [status, reload]);

  // Some actions answer with the updated Service and some with nothing; the
  // caller only cares that the work finished, so the result is ignored here.
  const runAction = async (action: (id: string) => Promise<unknown>, failure: string) => {
    setWorking(true);
    setActionError(null);
    try {
      await action(id);
      reload();
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : failure);
    } finally {
      setWorking(false);
    }
  };

  const remove = async () => {
    setWorking(true);
    setActionError(null);
    try {
      await removeService(id);
      navigate('/app/services');
    } catch (error) {
      setActionError(
        error instanceof ApiError ? error.message : 'This Service could not be removed. Try again.',
      );
      setWorking(false);
    }
  };

  const isRunning = status === 'running';
  const isStopped = status === 'stopped' || status === 'failed';
  const isDeploying = status === 'deploying';
  // An adopted workload was already running when SlideOps found it, so there is
  // nothing to rebuild it from and redeploying it is refused by the API.
  const isAdopted = service?.adopted === true;
  const ServiceHeroIcon = serviceIcon(service?.source?.image);

  return (
    <OperatorShell active="services">
      <button
        type="button"
        onClick={() => navigate('/app/services')}
        className="mb-4 inline-flex items-center gap-1 text-sm text-ink-muted transition-colors duration-fast ease-standard hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <ArrowLeft width={16} height={16} aria-hidden />
        All Services
      </button>

      {state.status === 'loading' ? <Loading label="Loading this Service" /> : null}
      {state.status === 'error' ? <ErrorNote error={state.error} /> : null}
      {service ? (
        <>
          <PageHeader
            title={service.name}
            description={`${state.status === 'ready' ? (state.data.project?.name ?? 'Unknown Project') : ''} · ${state.status === 'ready' ? (state.data.node?.name ?? 'Unknown Node') : ''}`}
            tabs={<TabNav tabs={SERVICE_TABS} active={activeTab} onSelect={setActiveTab} />}
            actions={
              <span className="inline-flex items-center gap-3">
                <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-md bg-subtle text-brand sm:inline-flex">
                  <ServiceHeroIcon width={18} height={18} aria-hidden />
                </span>
                <ServiceStatusBadge status={service.status} />
              </span>
            }
          />

          {isDeploying ? (
            <div
              role="status"
              className="mb-6 flex items-center gap-3 rounded-md border border-border bg-subtle px-4 py-3"
            >
              <RefreshCw width={16} height={16} className="animate-spin text-brand" aria-hidden />
              <Text variant="body-sm" tone="secondary">
                Deploying and verifying the workload. This updates on its own as the Service comes
                up.
              </Text>
            </div>
          ) : null}

          {service.last_error ? (
            <div role="alert" className="mb-6 rounded-md border border-danger bg-subtle px-4 py-3">
              <Text variant="body-sm" className="font-medium text-danger">
                The last deploy failed
              </Text>
              <Text variant="body-sm" tone="secondary" className="mt-1 break-words font-mono">
                {service.last_error}
              </Text>
            </div>
          ) : null}

          {activeTab === 'overview' ? (
          <DetailLayout
            main={
              <>
              {/* The address comes before the Preview on purpose. A Service that
                  serves an API has nothing to show in an iframe, and its address is
                  the whole answer; a Service that renders a page has both. */}
              <ServiceEndpoint service={service} onChanged={reload} />

              <ServicePreview service={service} />

              <Section title="Live usage" adornment={<Guidance for="service.metrics" />} collapsible>
                <ServiceMetricsPanel id={service.id} running={isRunning} />
              </Section>
              </>
            }
            rail={
              <>
              <Card className="h-fit">
                <Text variant="h4">Summary</Text>
                <dl className="mt-2 divide-y divide-border">
                  <SummaryRow label="Node">
                    <button
                      type="button"
                      onClick={() =>
                        state.status === 'ready' && state.data.node
                          ? navigate(`/app/nodes/${state.data.node.id}`)
                          : undefined
                      }
                      disabled={state.status !== 'ready' || !state.data.node}
                      className="inline-flex items-center gap-1.5 text-ink hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:text-ink-muted"
                    >
                      <Server width={14} height={14} aria-hidden />
                      {state.status === 'ready' ? (state.data.node?.name ?? 'Unknown Node') : ''}
                    </button>
                  </SummaryRow>
                  <SummaryRow label="Runtime">
                    {service.runtime === 'systemd' ? 'systemd unit' : 'Container'}
                  </SummaryRow>
                  <SummaryRow label="Source">{sourceText(service)}</SummaryRow>
                  <SummaryRow label="CPU limit">{service.cpu_limit} vCPU</SummaryRow>
                  <SummaryRow label="Memory limit">{memory(service.memory_mb)}</SummaryRow>
                  {typeof service.pids_limit === 'number' ? (
                    <SummaryRow label="Process limit">{service.pids_limit}</SummaryRow>
                  ) : null}
                  {service.ports && service.ports.length > 0 ? (
                    <SummaryRow label="Ports">
                      {service.ports.map((port) => `${port.host}:${port.container}`).join(', ')}
                    </SummaryRow>
                  ) : null}
                  <SummaryRow label="Created">
                    {new Date(service.created_at).toLocaleString()}
                  </SummaryRow>
                </dl>
              </Card>

              <ServiceResourcesPanel
                service={service}
                onUpdated={(updated) =>
                  setResized({
                    cpu_limit: updated.cpu_limit,
                    memory_mb: updated.memory_mb,
                    pids_limit: updated.pids_limit,
                  })
                }
              />

              <ServiceUpdatePanel service={service} onDeployed={reload} />

              <Card className="h-fit">
                <div className="flex items-center gap-2">
                  <Text variant="h4">Actions</Text>
                  <Guidance for="service.lifecycle" />
                </div>
                {!canWrite ? (
                  <Text variant="body-sm" tone="secondary" className="mt-4">
                    Starting, stopping, redeploying, or removing this Service needs a role above
                    Viewer in this workspace.
                  </Text>
                ) : (
                <div className="mt-4 flex flex-col gap-3">
                  {/* While a deploy is running, stopping it is the only thing worth
                      offering: the lifecycle actions have nothing settled to act on,
                      and Remove tears down a Service the Operator only wanted to stop
                      starting. */}
                  {isDeploying ? (
                    <Button
                      variant="danger"
                      onClick={() =>
                        runAction(cancelServiceDeploy, 'The deploy could not be cancelled.')
                      }
                      disabled={working}
                    >
                      <XCircle width={15} height={15} aria-hidden />
                      {working ? 'Cancelling' : 'Cancel this deploy'}
                    </Button>
                  ) : null}
                  {isStopped ? (
                    <Button
                      onClick={() => runAction(startService, 'The Service could not start.')}
                      disabled={working}
                    >
                      <Play width={15} height={15} aria-hidden />
                      Start
                    </Button>
                  ) : null}
                  {isRunning ? (
                    <Button
                      variant="secondary"
                      onClick={() => runAction(stopService, 'The Service could not stop.')}
                      disabled={working}
                    >
                      <Square width={15} height={15} aria-hidden />
                      Stop
                    </Button>
                  ) : null}
                  {/* Redeploying belongs beside the other lifecycle actions, not only
                      in the deployment panel: it is what applies a configuration
                      change, and an Operator looking for "apply my edit" looks here. */}
                  {!isDeploying && !isAdopted ? (
                    <Button
                      variant="secondary"
                      onClick={() =>
                        runAction(redeployService, 'The redeploy could not be started.')
                      }
                      disabled={working}
                    >
                      <RefreshCw width={15} height={15} aria-hidden />
                      Redeploy
                    </Button>
                  ) : null}
                  {isRunning || isStopped ? (
                    <Button
                      variant="secondary"
                      onClick={() => runAction(restartService, 'The Service could not restart.')}
                      disabled={working}
                    >
                      <RefreshCw width={15} height={15} aria-hidden />
                      Restart
                    </Button>
                  ) : null}

                  <div className="mt-2 border-t border-border pt-4">
                    {confirmRemove ? (
                      <div className="flex flex-col gap-3">
                        <Text variant="body-sm" tone="secondary">
                          {service.adopted
                            ? 'Stop managing this Service? SlideOps did not create this workload, so it keeps running on your server exactly as it is; it simply disappears from here.'
                            : 'Remove this Service? Its workload is stopped and removed, and the allocation is freed.'}
                        </Text>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmRemove(false)}
                            disabled={working}
                          >
                            Keep it
                          </Button>
                          <Button variant="danger" size="sm" onClick={remove} disabled={working}>
                            {working ? 'Working' : service.adopted ? 'Stop managing it' : 'Remove'}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmRemove(true)}
                        disabled={working}
                      >
                        <Trash2 width={15} height={15} aria-hidden />
                        {service.adopted ? 'Stop managing this Service' : 'Remove this Service'}
                      </Button>
                    )}
                  </div>
                </div>
                )}

                {actionError ? (
                  <p role="alert" className="mt-3 text-sm text-danger">
                    {actionError}
                  </p>
                ) : null}
              </Card>
              </>
            }
          />
          ) : null}

          {activeTab === 'browse' ? (
            <>
              {/* Scoped to this Service, so a database server shared by several
                  applications shows only the part this one uses. */}
              <Section
                title="Browse"
                description="What is actually inside, a page at a time, searchable. Nothing here changes anything."
              >
                <DatabaseExplorer
                  capabilityKey="install-postgresql"
                  nodeId={service.node_id}
                  serviceId={service.id}
                />
              </Section>
              <CapabilityManagement
                capabilityKey="install-postgresql"
                nodeId={service.node_id}
                serviceId={service.id}
                projectId={service.project_id}
                installed
                hideActionKeys={DATABASE_EXPLORER_ACTION_KEYS}
              />
            </>
          ) : null}

          {activeTab === 'shell' ? (
            <ShellTerminal
              standalonePath={`/app/services/${service.id}/shell`}
              urlFor={(cols, rows) => serviceShellUrl(service.id, cols, rows)}
              scopeLabel={
                service.runtime === 'systemd' ? 'This Service, on the server' : 'Inside this Service'
              }
              scopeDetail={
                service.runtime === 'systemd'
                  ? 'A shell on the server in this Service’s own directory. A systemd Service is not a container, so this one is not confined to it. Opening it is recorded in the audit trail.'
                  : 'A shell inside this Service’s own container, where only this application’s files and processes are reachable. The rest of the server is not. Opening it is recorded in the audit trail.'
              }
              unavailableReason={
                service.status === 'running'
                  ? undefined
                  : `This Service is ${service.status}, so there is nothing running to open a shell in.`
              }
            />
          ) : null}

          {activeTab === 'logs' ? <LogsAndActivity id={service.id} /> : null}

          {activeTab === 'settings' ? (
            <ServiceConfiguration service={service} onChanged={reload} />
          ) : null}
        </>
      ) : null}
    </OperatorShell>
  );
}
