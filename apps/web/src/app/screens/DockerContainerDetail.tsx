import {
  getNode,
  inspectDockerContainer,
  isDockerNotEnabled,
  isDockerUnavailable,
  listDockerContainers,
  listDockerStats,
  type DockerContainer,
  type DockerInspect,
} from '@slideops/api-client';
import { Button, Card, Text } from '@slideops/design-system';
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  Container as ContainerIcon,
  Database,
  FileText,
  Gauge,
  Network,
  ScanSearch,
  Terminal as TerminalIcon,
} from '@slideops/icons';
import { EmptyState, PageHeader, TabNav, type TabNavTab } from '@slideops/ui';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CopyButton } from '../components/CopyButton';
import { DockerContainerActions } from '../components/DockerContainerActions';
import {
  DockerHealthBadge,
  DockerOwnershipBadge,
  DockerStateBadge,
} from '../components/DockerContainerCard';
import { DockerContainerInspect } from '../components/DockerContainerInspect';
import { DockerContainerLogs } from '../components/DockerContainerLogs';
import { DockerContainerNetworks } from '../components/DockerContainerNetworks';
import { DockerExportPanel } from '../components/DockerExportPanel';
import { DockerRelationships } from '../components/DockerRelationships';
import { DockerContainerOverview } from '../components/DockerContainerOverview';
import { DockerContainerStats } from '../components/DockerContainerStats';
import { DockerContainerStorage } from '../components/DockerContainerStorage';
import { DockerContainerTerminal } from '../components/DockerContainerTerminal';
import { ErrorNote, Loading } from '../components/Feedback';
import { OperatorShell } from '../components/OperatorShell';
import { Refreshing } from '../components/Refreshing';
import { formatUptime, indexStats, statFor, uptimeSeconds } from '../docker-inventory';
import { useAsyncData } from '../hooks/useAsyncData';

/*
 * One container, in full.
 *
 * The Node is in the query string and the container is in the path, because
 * that is what identifies a container: Docker is a daemon on one machine, and a
 * container id is only meaningful next to the machine whose daemon issued it.
 * Both being in the URL means any view of this page, on any tab, is a link
 * somebody can paste into an incident channel and land on exactly what the
 * person before them was looking at.
 *
 * Reads and writes are strictly separated. Everything the page loads to render
 * itself observes and changes nothing; the lifecycle controls in the header are
 * the only things here that touch the server, and every one of them is behind a
 * control the Operator pressed, a role that may act, and -- for the two that
 * cannot be undone -- a confirmation that names the container.
 *
 * There is no single "get container" endpoint, so the container comes from the
 * Node's list. That is deliberate rather than a workaround: the list is where
 * ownership and the owning Service live, and those are exactly the facts a page
 * about acting on a container must not be missing.
 */

const CONTAINER_TABS: TabNavTab[] = [
  { key: 'overview', label: 'Overview', icon: Gauge },
  { key: 'logs', label: 'Logs', icon: FileText },
  { key: 'terminal', label: 'Terminal', icon: TerminalIcon },
  { key: 'stats', label: 'Stats', icon: Activity },
  { key: 'inspect', label: 'Inspect', icon: ScanSearch },
  { key: 'mounts', label: 'Mounts', icon: Database },
  { key: 'networks', label: 'Networks', icon: Network },
];
const DEFAULT_CONTAINER_TAB = 'overview';

/**
 * How often the container and its live sample are re-read, in milliseconds.
 *
 * The same five seconds the Docker list page and the Service metrics panel use,
 * so two live readings in this app never disagree about how stale they are.
 */
const REFRESH_MS = 5000;

/** The tabs whose content goes out of date on a clock rather than on an action. */
const LIVE_TABS = new Set(['overview', 'stats']);

/** The tabs that need the full inspect record. */
const INSPECT_TABS = new Set(['inspect', 'mounts', 'networks']);

/**
 * Re-run something on a fixed cadence while it is worth running.
 *
 * Self-rescheduling rather than setInterval, so a slow tick never stacks up
 * behind the one before it, and the timer is cleared on unmount and the moment
 * the work stops being wanted. It triggers a refetch rather than fetching
 * itself, which is what keeps the page from blinking.
 */
function useRefreshEvery(active: boolean, onTick: () => void) {
  const tick = useRef(onTick);
  tick.current = onTick;

  useEffect(() => {
    if (!active) {
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      timer = setTimeout(() => {
        if (cancelled) {
          return;
        }
        tick.current();
        schedule();
      }, REFRESH_MS);
    };
    schedule();
    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [active]);
}

/**
 * Whether this container is the one the link named.
 *
 * A link may carry the full id, the short id or the name, because all three are
 * things an Operator copies and all three are what the daemon accepts. Matching
 * on a prefix of the full id as well covers the ids Docker prints at other
 * lengths in its own output.
 */
function matches(container: DockerContainer, ref: string): boolean {
  return (
    container.full_id === ref ||
    container.id === ref ||
    container.name === ref ||
    (ref.length >= 12 && container.full_id.startsWith(ref))
  );
}

/** A labelled fact in the header. Absent data is a dash, never a zero. */
function HeaderFact({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="min-w-0">
      <Text variant="caption" tone="secondary" className="block">
        {label}
      </Text>
      <span className="mt-0.5 block truncate text-sm text-ink" title={value ?? undefined}>
        {value ? value : '--'}
      </span>
    </div>
  );
}

/** A timestamp in the Operator's own locale, or a dash when there is none. */
function moment(at?: string): string | null {
  if (!at) {
    return null;
  }
  const date = new Date(at);
  return Number.isNaN(date.getTime()) ? at : date.toLocaleString();
}

interface ContainerPageProps {
  nodeId: string;
  nodeName: string;
  containerRef: string;
  tab: string;
}

/** Everything below the shell, once the Node is known. */
function ContainerPage({ nodeId, nodeName, containerRef, tab }: ContainerPageProps) {
  const navigate = useNavigate();
  const [removed, setRemoved] = useState(false);

  const containers = useAsyncData((signal) => listDockerContainers(nodeId, signal), [nodeId]);
  const stats = useAsyncData((signal) => listDockerStats(nodeId, signal), [nodeId]);

  // Loaded only for the tabs that read it, and kept across a move between those
  // tabs: Inspect, Mounts and Networks are three readings of one record, so
  // switching between them must not cost the Node three round trips.
  const needsInspect = INSPECT_TABS.has(tab);
  const inspect = useAsyncData<DockerInspect | null>(
    (signal) =>
      needsInspect ? inspectDockerContainer(nodeId, containerRef, signal) : Promise.resolve(null),
    [nodeId, containerRef, needsInspect],
  );

  const reloadContainers = containers.reload;
  const reloadStats = stats.reload;
  useRefreshEvery(LIVE_TABS.has(tab) && !removed, () => {
    reloadContainers();
    reloadStats();
  });

  const notEnabled = isDockerNotEnabled(containers.state.error);
  if (notEnabled) {
    return (
      <EmptyState
        icon={ContainerIcon}
        title="The Docker workspace is not enabled here"
        description="This deployment has not switched the Docker workspace on yet. Nothing on your servers is affected, and everything else in SlideOps works as it did. An Admin can enable it from Feature Flags."
      />
    );
  }

  if (isDockerUnavailable(containers.state.error)) {
    return (
      <EmptyState
        icon={ContainerIcon}
        title={`Docker was not detected on ${nodeName}`}
        description={`SlideOps asked ${nodeName} about Docker and found no daemon answering, so it cannot say anything about this container. Nothing was changed on the server.`}
        action={
          <Button variant="secondary" onClick={() => navigate(`/app/docker?node=${nodeId}`)}>
            Back to Docker on this server
          </Button>
        }
      />
    );
  }

  if (containers.state.status === 'loading') {
    return <Loading label={`Reading Docker on ${nodeName}, read only`} />;
  }
  if (containers.state.status === 'error') {
    return <ErrorNote error={containers.state.error} />;
  }

  const container = containers.state.data.find((candidate) => matches(candidate, containerRef));

  // A container that has just been removed is gone on purpose, and saying "not
  // found" about it would read as a fault rather than as the outcome of what
  // the Operator asked for a second ago.
  if (!container) {
    return (
      <EmptyState
        icon={ContainerIcon}
        title={removed ? 'This container has been removed' : 'No such container on this server'}
        description={
          removed
            ? `It is gone from ${nodeName}. Its image is still there, and so is any named volume it had mounted.`
            : `${nodeName} has no container matching this link. It may have been removed, or the link may name a container on a different server.`
        }
        action={
          <Button onClick={() => navigate(`/app/docker?node=${nodeId}&tab=containers`)}>
            See the containers on {nodeName}
          </Button>
        }
      />
    );
  }

  const stat = statFor(
    container,
    indexStats(stats.state.status === 'ready' ? stats.state.data : []),
  );
  const uptime = uptimeSeconds(container);

  return (
    <div className="flex flex-col gap-6">
      <Refreshing show={containers.refreshing || stats.refreshing} label="Reading the daemon" />

      <Card className="flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Text variant="h3" className="truncate">
                {container.name}
              </Text>
              <DockerStateBadge state={container.state} />
              <DockerHealthBadge health={container.health} />
              <DockerOwnershipBadge ownership={container.ownership} />
            </div>
            <span
              className="mt-1 block truncate font-mono text-xs text-ink-muted"
              title={container.image}
            >
              {container.image}
            </span>
            {container.service_id ? (
              <Link
                to={`/app/services/${container.service_id}`}
                className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                Open the Service that manages it
                <ArrowUpRight width={14} height={14} aria-hidden />
              </Link>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <CopyButton value={container.name} label={`the name of ${container.name}`} />
            <CopyButton value={container.full_id} label={`the id of ${container.name}`} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <HeaderFact label="Short id" value={container.id} />
          <HeaderFact label="Created" value={moment(container.created_at)} />
          <HeaderFact label="Started" value={moment(container.started_at)} />
          <HeaderFact
            label="Uptime"
            value={uptime === null ? 'Not running' : formatUptime(uptime)}
          />
        </div>

        <Text variant="body-sm" tone="secondary">
          {container.status_text}
        </Text>

        <div className="border-t border-border pt-4">
          <DockerContainerActions
            nodeId={nodeId}
            container={container}
            onChanged={() => {
              reloadContainers();
              reloadStats();
            }}
            onRemoved={() => {
              setRemoved(true);
              reloadContainers();
            }}
          />
        </div>
      </Card>

      {tab === 'overview' ? (
        <DockerContainerOverview
          nodeId={nodeId}
          nodeName={nodeName}
          container={container}
          stat={stat}
        />
      ) : null}

      {tab === 'logs' ? (
        <DockerContainerLogs
          nodeId={nodeId}
          containerRef={container.full_id}
          containerName={container.name}
        />
      ) : null}

      {tab === 'terminal' ? (
        <DockerContainerTerminal
          nodeId={nodeId}
          nodeName={nodeName}
          containerRef={container.full_id}
          containerName={container.name}
          running={container.state === 'running'}
        />
      ) : null}

      {tab === 'stats' ? <DockerContainerStats stat={stat} containerName={container.name} /> : null}

      {needsInspect ? (
        <>
          {inspect.state.status === 'loading' ? (
            <Loading label={`Inspecting ${container.name}, read only`} />
          ) : null}
          {inspect.state.status === 'error' ? <ErrorNote error={inspect.state.error} /> : null}
          {inspect.state.status === 'ready' && inspect.state.data ? (
            <>
              {tab === 'inspect' ? (
                <div className="flex flex-col gap-6">
                  <DockerContainerInspect
                    inspect={inspect.state.data}
                    containerName={container.name}
                  />
                  {/* Built from the same inspect, so an export can never
                      describe a container differently from the page above it. */}
                  <DockerExportPanel inspect={inspect.state.data} />
                </div>
              ) : null}
              {tab === 'mounts' ? (
                <DockerContainerStorage
                  inspect={inspect.state.data}
                  containerName={container.name}
                  nodeName={nodeName}
                />
              ) : null}
              {tab === 'networks' ? (
                <div className="flex flex-col gap-6">
                  <DockerContainerNetworks
                    inspect={inspect.state.data}
                    containerName={container.name}
                    nodeName={nodeName}
                  />
                  {/* Only the containers are passed, so the panel reports the
                      volume and network lists as unread rather than answering
                      "nothing uses this" from records nobody fetched. */}
                  <DockerRelationships
                    nodeId={nodeId}
                    target={{ kind: 'container', name: container.name }}
                    inventory={{ containers: [container] }}
                  />
                </div>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/** One container on one Node: its state, its usage, its output, and the controls for it. */
export function DockerContainerDetail() {
  const { ref = '' } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const nodeId = searchParams.get('node') ?? '';

  const activeTab = CONTAINER_TABS.some((tab) => tab.key === searchParams.get('tab'))
    ? (searchParams.get('tab') as string)
    : DEFAULT_CONTAINER_TAB;
  const setActiveTab = (key: string) => {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (key === DEFAULT_CONTAINER_TAB) {
          next.delete('tab');
        } else {
          next.set('tab', key);
        }
        return next;
      },
      { replace: true },
    );
  };

  // The Node is not optional and there is no sensible default for it. Picking
  // the Operator's first server would show a different machine's container
  // under this link, which is the one mistake this page must never make.
  const nodeResult = useAsyncData(
    (signal) => (nodeId ? getNode(nodeId, signal) : Promise.resolve(null)),
    [nodeId],
  );
  const node = nodeResult.state.status === 'ready' ? nodeResult.state.data : null;

  return (
    <OperatorShell active="docker">
      <PageHeader
        title={ref || 'Container'}
        description={
          node
            ? `One container on ${node.name}. Everything here reads the daemon; the controls in the header are the only things that change it.`
            : 'One container on one of your servers.'
        }
        actions={
          <Button
            variant="secondary"
            onClick={() =>
              navigate(nodeId ? `/app/docker?node=${nodeId}&tab=containers` : '/app/docker')
            }
          >
            <ArrowLeft width={15} height={15} aria-hidden />
            All containers
          </Button>
        }
        tabs={
          node ? (
            <TabNav tabs={CONTAINER_TABS} active={activeTab} onSelect={setActiveTab} />
          ) : undefined
        }
      />

      {!nodeId ? (
        <EmptyState
          icon={ContainerIcon}
          title="This link does not say which server"
          description="A container id only means something next to the daemon that issued it, so SlideOps will not guess a server. Open the container from the Docker page and the link will carry the server with it."
          action={<Button onClick={() => navigate('/app/docker')}>Go to Docker</Button>}
        />
      ) : null}

      {nodeId && nodeResult.state.status === 'loading' ? (
        <Loading label="Loading the server" />
      ) : null}
      {nodeId && nodeResult.state.status === 'error' ? (
        <ErrorNote error={nodeResult.state.error} />
      ) : null}

      {node ? (
        // Keyed by Node and container so following a link to a different one
        // starts a clean read rather than showing one container's output under
        // another container's name.
        <ContainerPage
          key={`${node.id}:${ref}`}
          nodeId={node.id}
          nodeName={node.name}
          containerRef={ref}
          tab={activeTab}
        />
      ) : null}
    </OperatorShell>
  );
}
