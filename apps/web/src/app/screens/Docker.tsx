import {
  getDockerOverview,
  isDockerUnavailable,
  isDockerNotEnabled,
  listDockerContainers,
  listDockerStats,
  getSavedDiscovery,
  listNodes,
  type DockerContainer,
  type DockerContainerState,
  type DockerHealth,
  type DockerOwnership,
  type DockerStats,
  type Node,
} from '@slideops/api-client';
import { Button, Text } from '@slideops/design-system';
import {
  Container as ContainerIcon,
  Activity,
  Database,
  Gauge,
  HardDrive,
  Layers,
  Network,
  Trash2,
  Server,
} from '@slideops/icons';
import { EmptyState, PageHeader, SearchBar, TabNav, Toolbar, type TabNavTab } from '@slideops/ui';
import { DockerImagesPanel } from '../components/DockerImagesPanel';
import { DockerVolumesPanel } from '../components/DockerVolumesPanel';
import { DockerNetworksPanel } from '../components/DockerNetworksPanel';
import { DockerCleanupPanel } from '../components/DockerCleanupPanel';
import { DockerEventsPanel } from '../components/DockerEventsPanel';
import { DockerComposeWorkspace } from '../components/DockerComposeWorkspace';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCanWrite } from '../../store/workspace';
import { DockerContainerCard } from '../components/DockerContainerCard';
import { DockerBulkActions } from '../components/DockerBulkActions';
import { DockerOverviewPanel } from '../components/DockerOverviewPanel';
import { DockerCapacityPanel } from '../components/DockerCapacityPanel';
import { DockerRankings } from '../components/DockerRankings';
import { ErrorNote, Loading } from '../components/Feedback';
import { OperatorShell } from '../components/OperatorShell';
import { FloatingRefreshIndicator } from '../components/FloatingRefreshIndicator';
import { useAsyncData } from '../hooks/useAsyncData';
import {
  CONTAINER_HEALTHS,
  CONTAINER_OWNERSHIPS,
  CONTAINER_STATES,
  filterContainers,
  indexStats,
  searchContainers,
  sortContainers,
  statFor,
  type ContainerFilter,
  type ContainerSort,
  type ContainerSortField,
} from '../docker-inventory';

/*
 * The Docker control centre.
 *
 * Docker is a daemon on one machine, so this page is about one Node and says
 * which one at all times. There is no Workspace-wide container list here and
 * there should not be: six unrelated daemons added together is a fleet view
 * nobody can act on, and the first question an Operator asks about a container
 * is always "on which server".
 *
 * Everything on this page reads. There are no lifecycle controls yet because
 * there are no lifecycle endpoints yet, and a stop button that cannot stop
 * anything is a worse thing to put on a page about somebody's production
 * server than no button at all. When those endpoints exist they will arrive
 * through the Operation approval gate like every other change, not as a
 * shortcut bolted onto a read screen.
 *
 * The Node and the tab both live in the query string, so any view of this page
 * is a link somebody can paste into an incident channel.
 */

const DOCKER_TABS: TabNavTab[] = [
  { key: 'overview', label: 'Overview', icon: Gauge },
  { key: 'containers', label: 'Containers', icon: ContainerIcon },
  { key: 'compose', label: 'Compose', icon: Layers },
  { key: 'images', label: 'Images', icon: HardDrive },
  { key: 'volumes', label: 'Volumes', icon: Database },
  { key: 'networks', label: 'Networks', icon: Network },
  { key: 'events', label: 'Events', icon: Activity },
  { key: 'cleanup', label: 'Cleanup', icon: Trash2 },
];
const DEFAULT_DOCKER_TAB = 'overview';

/**
 * How often the container list and its live samples refresh, in milliseconds.
 *
 * Five seconds is the same cadence the Service metrics panel already uses, so
 * two live readings in this app never disagree about how stale they are. Each
 * tick is one pass over the Node, so it runs only while a tab that shows those
 * numbers is on screen.
 */
const REFRESH_MS = 5000;

const inputClass =
  'h-9 rounded-md border border-border bg-surface px-2.5 text-sm text-ink transition-colors duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';

const SORT_FIELDS: { value: ContainerSortField; label: string }[] = [
  { value: 'state', label: 'State' },
  { value: 'name', label: 'Name' },
  { value: 'cpu', label: 'CPU' },
  { value: 'memory', label: 'Memory' },
  { value: 'uptime', label: 'Uptime' },
  { value: 'created', label: 'Created' },
  { value: 'restarts', label: 'Restarts' },
];

const STATE_LABELS: Record<DockerContainerState, string> = {
  running: 'Running',
  restarting: 'Restarting',
  paused: 'Paused',
  created: 'Created',
  exited: 'Exited',
  dead: 'Dead',
};

const OWNERSHIP_LABELS: Record<DockerOwnership, string> = {
  slideops: 'SlideOps Managed',
  external: 'External',
  unknown: 'Unknown origin',
};

const HEALTH_LABELS: Record<DockerHealth, string> = {
  healthy: 'Healthy',
  unhealthy: 'Unhealthy',
  starting: 'Starting',
  none: 'No healthcheck',
};

/** One labelled dropdown in the toolbar, with a visible label a screen reader also reads. */
function Picker({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex items-center gap-1.5">
      <span className="text-xs font-medium text-ink-muted">{label}</span>
      <select
        aria-label={label}
        className={inputClass}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </select>
    </label>
  );
}

/**
 * Re-run something on a fixed cadence while it is worth running.
 *
 * Self-rescheduling rather than setInterval, so a slow tick never stacks up
 * behind the one before it, and the timer is cleared on unmount and whenever
 * the work stops being wanted. It triggers a refetch rather than fetching
 * itself, which is what keeps the screen from blinking: `reload` refreshes
 * underneath and leaves the current data on screen.
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

/** The search, filter and sort controls, and the containers they narrow. */
function ContainersTab({
  nodeId,
  containers,
  stats,
  onChanged,
}: {
  nodeId: string;
  containers: DockerContainer[];
  stats: DockerStats[];
  /** Re-read after a bulk run: the list is stale the moment anything acts. */
  onChanged: () => void;
}) {
  const [query, setQuery] = useState('');
  const [state, setState] = useState<'' | DockerContainerState>('');
  const [ownership, setOwnership] = useState<'' | DockerOwnership>('');
  const [health, setHealth] = useState<'' | DockerHealth>('');
  const [sort, setSort] = useState<ContainerSort>({ field: 'state', direction: 'asc' });

  const filtering = query !== '' || state !== '' || ownership !== '' || health !== '';

  // Every one of these runs over data already in hand, so narrowing is instant
  // and never costs the Node a request. A filter that has to ask a server is a
  // filter people stop using.
  const shown = useMemo(() => {
    const filter: ContainerFilter = {
      states: state ? [state] : undefined,
      ownership: ownership ? [ownership] : undefined,
      health: health ? [health] : undefined,
    };
    const narrowed = filterContainers(searchContainers(containers, query), filter, { stats });
    return sortContainers(narrowed, sort, stats);
  }, [containers, stats, query, state, ownership, health, sort]);

  const index = useMemo(() => indexStats(stats), [stats]);

  // Selection is held by full id rather than by container, so a reload that
  // replaces every object keeps the selection instead of silently emptying it.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selected = shown.filter((container) => selectedIds.has(container.full_id));

  const toggleSelected = (fullId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (!next.delete(fullId)) {
        next.add(fullId);
      }
      return next;
    });
  };

  const clear = () => {
    setQuery('');
    setState('');
    setOwnership('');
    setHealth('');
  };

  if (containers.length === 0) {
    return (
      <EmptyState
        icon={ContainerIcon}
        title="No containers on this server"
        description="Docker is running here but has no containers, not even stopped ones. Anything you deploy to this server will appear here."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <DockerBulkActions
        nodeId={nodeId}
        selected={selected}
        onDone={onChanged}
        onClearSelection={() => setSelectedIds(new Set())}
      />

      <Toolbar
        actions={
          <Text variant="body-sm" tone="secondary">
            {shown.length} of {containers.length}
          </Text>
        }
      >
        <SearchBar
          value={query}
          onChange={setQuery}
          label="Search containers"
          placeholder="Name, image, port, Compose project, label..."
          className="sm:max-w-xs"
        />
        <Picker
          label="State"
          value={state}
          onChange={(v) => setState(v as '' | DockerContainerState)}
        >
          <option value="">Any state</option>
          {CONTAINER_STATES.map((value) => (
            <option key={value} value={value}>
              {STATE_LABELS[value]}
            </option>
          ))}
        </Picker>
        <Picker
          label="Origin"
          value={ownership}
          onChange={(v) => setOwnership(v as '' | DockerOwnership)}
        >
          <option value="">Any origin</option>
          {CONTAINER_OWNERSHIPS.map((value) => (
            <option key={value} value={value}>
              {OWNERSHIP_LABELS[value]}
            </option>
          ))}
        </Picker>
        <Picker label="Health" value={health} onChange={(v) => setHealth(v as '' | DockerHealth)}>
          <option value="">Any health</option>
          {CONTAINER_HEALTHS.map((value) => (
            <option key={value} value={value}>
              {HEALTH_LABELS[value]}
            </option>
          ))}
        </Picker>
        <Picker
          label="Sort by"
          value={sort.field}
          onChange={(v) => setSort((was) => ({ ...was, field: v as ContainerSortField }))}
        >
          {SORT_FIELDS.map((field) => (
            <option key={field.value} value={field.value}>
              {field.label}
            </option>
          ))}
        </Picker>
        <Button
          variant="secondary"
          size="sm"
          onClick={() =>
            setSort((was) => ({ ...was, direction: was.direction === 'asc' ? 'desc' : 'asc' }))
          }
        >
          {sort.direction === 'asc' ? 'Ascending' : 'Descending'}
        </Button>
      </Toolbar>

      {shown.length === 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-dashed border-border bg-surface px-4 py-6">
          <Text variant="body-sm" tone="secondary" className="flex-1">
            No container on this server matches what you are looking for.
          </Text>
          <Button variant="secondary" size="sm" onClick={clear}>
            Clear the filters
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 2xl:grid-cols-2">
          {shown.map((container) => (
            <div key={container.full_id} className="flex items-start gap-3">
              <input
                type="checkbox"
                aria-label={`Select ${container.name}`}
                checked={selectedIds.has(container.full_id)}
                onChange={() => toggleSelected(container.full_id)}
                className="mt-6 h-4 w-4 shrink-0 rounded border-border text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              />
              <div className="min-w-0 flex-1">
                <DockerContainerCard
                  container={container}
                  stat={statFor(container, index)}
                  nodeId={nodeId}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {filtering ? (
        <Text variant="body-sm" tone="secondary">
          Filters narrow what is already loaded. Nothing is hidden from the counts on Overview.
        </Text>
      ) : null}
    </div>
  );
}

/**
 * Docker on one Node.
 *
 * The overview, the container list and the live samples load together because
 * two of the five tabs need all three, and switching between Overview and
 * Containers should not cost a round trip. The three inventory tabs mount
 * their own read, so an Operator who never opens Images never asks the Node
 * for its images.
 */
function DockerOnNode({ node, tab }: { node: Node; tab: string }) {
  const navigate = useNavigate();
  const canWrite = useCanWrite();

  const overview = useAsyncData((signal) => getDockerOverview(node.id, signal), [node.id]);
  const containers = useAsyncData((signal) => listDockerContainers(node.id, signal), [node.id]);
  const stats = useAsyncData((signal) => listDockerStats(node.id, signal), [node.id]);
  // Read rather than discovered: the capacity panel needs the Node's own cores,
  // memory and disk, and the last saved Discovery already has them. Asking the
  // server again would open an SSH connection to draw a bar.
  const discovery = useAsyncData((signal) => getSavedDiscovery(node.id, signal), [node.id]);

  // Only the two tabs that show live numbers are worth a repeated pass over
  // the Node. Images, volumes and networks change when somebody changes them,
  // not on a clock, so polling them would be noise on the wire and nothing on
  // the screen.
  const live = tab === 'overview' || tab === 'containers';
  const reloadContainers = containers.reload;
  const reloadStats = stats.reload;
  useRefreshEvery(live, () => {
    reloadContainers();
    reloadStats();
  });

  /*
   * "Docker is not here" is not a failure. On a Node that has never had Docker
   * installed it is the plain truth, and it is by far the most common reason
   * these reads do not answer, so it gets a calm empty state that names the
   * server and offers the Capability that would change it -- not a red banner
   * about a request that broke.
   */
  /*
   * A deployment that has not switched the Docker workspace on answers every
   * read here with docker_not_enabled. That is not a fault and not a server
   * without Docker, so it gets its own calm explanation rather than the
   * "install Docker" one, which would be advice about the wrong problem.
   */
  const notEnabled =
    isDockerNotEnabled(overview.state.error) || isDockerNotEnabled(containers.state.error);
  if (notEnabled) {
    return (
      <EmptyState
        icon={ContainerIcon}
        title="The Docker workspace is not enabled here"
        description="This deployment has not switched the Docker workspace on yet. Nothing on your servers is affected, and everything else in SlideOps works as it did. An Admin can enable it from Feature Flags."
      />
    );
  }

  const unavailable =
    isDockerUnavailable(overview.state.error) || isDockerUnavailable(containers.state.error);
  if (unavailable) {
    return (
      <EmptyState
        icon={ContainerIcon}
        title={`Docker was not detected on ${node.name}`}
        description={`SlideOps asked ${node.name} about Docker and found no daemon answering. Nothing was changed on the server. Enabling containers installs Docker there as a Capability you review and approve first.`}
        action={
          canWrite ? (
            <Button onClick={() => navigate(`/app/capabilities/enable-containers?node=${node.id}`)}>
              Enable containers on this server
            </Button>
          ) : undefined
        }
      />
    );
  }

  if (tab === 'images') {
    return <DockerImagesPanel nodeId={node.id} />;
  }
  if (tab === 'volumes') {
    return <DockerVolumesPanel nodeId={node.id} />;
  }
  if (tab === 'networks') {
    return <DockerNetworksPanel nodeId={node.id} />;
  }
  if (tab === 'compose') {
    return <DockerComposeWorkspace nodeId={node.id} />;
  }
  if (tab === 'events') {
    return <DockerEventsPanel nodeId={node.id} />;
  }
  if (tab === 'cleanup') {
    return <DockerCleanupPanel nodeId={node.id} />;
  }

  const failure = overview.state.error ?? containers.state.error ?? null;
  const loading =
    overview.state.status === 'loading' ||
    containers.state.status === 'loading' ||
    stats.state.status === 'loading';

  // Stats are the one read that is allowed to fail quietly. A container list
  // with no live numbers beside it is still a true container list; the cards
  // show "--" and say why, which is better than replacing the page with an
  // error about a sampling pass.
  const containerList = containers.state.status === 'ready' ? containers.state.data : [];
  const statList = stats.state.status === 'ready' ? stats.state.data : [];

  return (
    <div className="flex flex-col gap-4">
      {/* Rendered only while a refresh is actually in flight, so an idle page
          carries no empty row where an indicator would be. */}
      <FloatingRefreshIndicator
        show={containers.refreshing || stats.refreshing}
        label="Reading the daemon"
      />

      {/* One panel, not one per failed read. When the daemon is unreachable
          every read fails with the same cause, and stacking three identical
          red boxes says nothing the first one did not. */}
      {failure ? <ErrorNote error={failure} /> : null}
      {loading ? <Loading label={`Reading Docker on ${node.name}, read only`} /> : null}

      {tab === 'containers' && containers.state.status === 'ready' ? (
        <ContainersTab
          nodeId={node.id}
          containers={containerList}
          stats={statList}
          onChanged={() => {
            void containers.reload();
            void stats.reload();
          }}
        />
      ) : null}

      {tab === 'overview' && overview.state.status === 'ready' ? (
        <div className="flex flex-col gap-6">
          <DockerOverviewPanel
            overview={overview.state.data}
            containers={containerList}
            stats={statList}
          />
          {/* Both read the containers and samples already on this page rather
              than fetching again, so they cannot disagree with the panel above
              about what is running. */}
          <DockerCapacityPanel
            containers={containerList}
            stats={statList}
            overview={overview.state.data}
            facts={discovery.state.status === 'ready' ? discovery.state.data.facts : null}
          />
          <DockerRankings nodeId={node.id} containers={containerList} stats={statList} />
        </div>
      ) : null}
    </div>
  );
}

/** The Docker control centre: one Node's daemon, containers, images, volumes and networks. */
export function Docker() {
  const navigate = useNavigate();
  const canWrite = useCanWrite();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = DOCKER_TABS.some((tab) => tab.key === searchParams.get('tab'))
    ? (searchParams.get('tab') as string)
    : DEFAULT_DOCKER_TAB;
  const setActiveTab = (key: string) => {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (key === DEFAULT_DOCKER_TAB) {
          next.delete('tab');
        } else {
          next.set('tab', key);
        }
        return next;
      },
      { replace: true },
    );
  };

  const nodesResult = useAsyncData((signal) => listNodes(signal), []);
  const nodes = nodesResult.state.status === 'ready' ? nodesResult.state.data : [];

  // A Node named in the link wins; anything else falls back to the first one,
  // so a stale or mistyped link still lands on a working page rather than on
  // an error about an id nobody typed on purpose.
  const requested = searchParams.get('node');
  const node = nodes.find((candidate) => candidate.id === requested) ?? nodes[0];

  const setNode = (id: string) => {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.set('node', id);
        return next;
      },
      { replace: true },
    );
  };

  return (
    <OperatorShell active="docker">
      <PageHeader
        title="Docker"
        description="What Docker is actually running on one of your servers: the daemon, every container on it, and what it is holding on disk. This page only reads."
        actions={
          // One server needs no picker. Offering a dropdown with a single entry
          // is a decision nobody has to make, dressed up as one they do.
          nodes.length > 1 ? (
            <label className="flex items-center gap-2">
              <span className="text-xs font-medium text-ink-muted">Server</span>
              <select
                aria-label="Server"
                className={inputClass}
                value={node?.id ?? ''}
                onChange={(event) => setNode(event.target.value)}
              >
                {nodes.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.name}
                  </option>
                ))}
              </select>
            </label>
          ) : undefined
        }
        tabs={
          node ? (
            <TabNav tabs={DOCKER_TABS} active={activeTab} onSelect={setActiveTab} />
          ) : undefined
        }
      />

      {nodesResult.state.status === 'loading' ? <Loading label="Loading your servers" /> : null}
      {nodesResult.state.status === 'error' ? <ErrorNote error={nodesResult.state.error} /> : null}

      {nodesResult.state.status === 'ready' && !node ? (
        <EmptyState
          icon={Server}
          title="No servers connected yet"
          description="Docker runs on a server, so there is nothing to show until one is connected. Connect a Linux machine over SSH and SlideOps will read its state without changing anything."
          action={
            canWrite ? (
              <Button onClick={() => navigate('/app/nodes/new')}>Connect your first server</Button>
            ) : undefined
          }
        />
      ) : null}

      {/* Keyed by Node so switching servers starts a clean read rather than
          showing one server's containers under another server's name. */}
      {node ? <DockerOnNode key={node.id} node={node} tab={activeTab} /> : null}
    </OperatorShell>
  );
}
