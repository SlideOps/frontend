import {
  ApiError,
  getNode,
  getProject,
  getService,
  getServiceLogs,
  removeService,
  restartService,
  startService,
  stopService,
  type Node,
  type Project,
  type Service,
} from '@slideops/api-client';
import { Button, Card, Text } from '@slideops/design-system';
import { ArrowLeft, Container, Play, RefreshCw, Server, Square, Trash2 } from '@slideops/icons';
import { Guidance } from '@slideops/tooltips';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ServiceStatusBadge } from '../components/Badges';
import { ErrorNote, Loading } from '../components/Feedback';
import { OperatorShell } from '../components/OperatorShell';
import { ServiceMetricsPanel } from '../components/ServiceMetrics';
import { ServicePreview } from '../components/ServicePreview';
import { ServiceResourcesPanel } from '../components/ServiceResourcesPanel';
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
    <div className="grid grid-cols-[8rem_1fr] gap-3 py-2">
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

/** A simple, read-only log view. Preserves formatting and belongs to both themes. */
function LogView({ id }: { id: string }) {
  const { state, reload } = useAsyncData((signal) => getServiceLogs(id, 200, signal), [id]);
  const logs = state.status === 'ready' ? state.data.trim() : '';

  return (
    <Card>
      <div className="mb-3 flex items-center gap-2">
        <Text variant="h4">Logs</Text>
        <Guidance for="service.logs" />
        <Button variant="ghost" size="sm" className="ml-auto" onClick={reload}>
          <RefreshCw width={14} height={14} aria-hidden />
          Refresh
        </Button>
      </div>
      {state.status === 'loading' ? <Loading label="Reading recent logs" /> : null}
      {state.status === 'error' ? <ErrorNote error={state.error} /> : null}
      {state.status === 'ready' ? (
        logs ? (
          <pre
            role="log"
            aria-label="Recent Service logs"
            className="max-h-80 w-full min-w-0 max-w-full overflow-auto rounded-md border border-border bg-app p-3 font-mono text-xs leading-relaxed text-ink"
          >
            {logs}
          </pre>
        ) : (
          <Text variant="body-sm" tone="secondary">
            No logs yet.
          </Text>
        )
      ) : null}
    </Card>
  );
}

/** The Service detail: summary, live metrics, lifecycle actions, and logs. */
export function ServiceDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { state, reload } = useAsyncData((signal) => loadDetail(id, signal), [id]);

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

  const runAction = async (action: (id: string) => Promise<void>, failure: string) => {
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
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-subtle text-brand">
                <Container width={22} height={22} aria-hidden />
              </span>
              <div className="min-w-0">
                <Text variant="h1">{service.name}</Text>
                <Text variant="body-sm" tone="secondary" className="mt-1">
                  {state.status === 'ready' ? state.data.project?.name ?? 'Unknown Project' : ''} ·{' '}
                  {state.status === 'ready' ? state.data.node?.name ?? 'Unknown Node' : ''}
                </Text>
              </div>
            </div>
            <ServiceStatusBadge status={service.status} />
          </div>

          {isDeploying ? (
            <div role="status" className="mb-6 flex items-center gap-3 rounded-md border border-border bg-subtle px-4 py-3">
              <RefreshCw width={16} height={16} className="animate-spin text-brand" aria-hidden />
              <Text variant="body-sm" tone="secondary">
                Deploying and verifying the workload. This updates on its own as the Service comes up.
              </Text>
            </div>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
            <div className="flex min-w-0 flex-col gap-6">
              <ServicePreview service={service} />

              <Card>
                <div className="mb-3 flex items-center gap-2">
                  <Text variant="h4">Live usage</Text>
                  <Guidance for="service.metrics" />
                </div>
                <ServiceMetricsPanel id={service.id} running={isRunning} />
              </Card>

              <LogView id={service.id} />
            </div>

            <div className="flex min-w-0 flex-col gap-6">
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
                      {state.status === 'ready' ? state.data.node?.name ?? 'Unknown Node' : ''}
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
                <div className="mt-4 flex flex-col gap-3">
                  {isStopped ? (
                    <Button onClick={() => runAction(startService, 'The Service could not start.')} disabled={working}>
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
                      <Button variant="ghost" size="sm" onClick={() => setConfirmRemove(true)} disabled={working}>
                        <Trash2 width={15} height={15} aria-hidden />
                        {service.adopted ? 'Stop managing this Service' : 'Remove this Service'}
                      </Button>
                    )}
                  </div>
                </div>

                {actionError ? (
                  <p role="alert" className="mt-3 text-sm text-danger">
                    {actionError}
                  </p>
                ) : null}
              </Card>
            </div>
          </div>
        </>
      ) : null}
    </OperatorShell>
  );
}
