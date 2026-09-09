import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  DOCKER_UNAVAILABLE_CODE,
  type DockerContainer,
  type DockerOverview,
  type DockerStats,
  type Node,
} from '@slideops/api-client';
import { renderInApp } from '../../test/render';
import { useWorkspaceStore } from '../../store/workspace';

/*
 * The Docker screen, tested through what an Operator sees rather than through
 * markup. The rules worth holding here are the ones this page would be
 * dishonest without: an absent daemon reads as an absent daemon and not as a
 * broken request, an unsampled container shows no number at all, and a
 * container SlideOps did not deploy is labelled as somebody else's.
 *
 * Polling is deliberately not asserted. Its cadence is a timer wrapped around
 * a hook that keeps its data across a refetch, so a test of it asserts almost
 * nothing while being the first thing to go flaky in CI.
 */

const listNodes = vi.fn();
const getDockerOverview = vi.fn();
const listDockerContainers = vi.fn();
const listDockerStats = vi.fn();
const listDockerImages = vi.fn();
const listDockerVolumes = vi.fn();
const listDockerNetworks = vi.fn();

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  listNodes: (...a: unknown[]) => listNodes(...a),
  getDockerOverview: (...a: unknown[]) => getDockerOverview(...a),
  listDockerContainers: (...a: unknown[]) => listDockerContainers(...a),
  listDockerStats: (...a: unknown[]) => listDockerStats(...a),
  listDockerImages: (...a: unknown[]) => listDockerImages(...a),
  listDockerVolumes: (...a: unknown[]) => listDockerVolumes(...a),
  listDockerNetworks: (...a: unknown[]) => listDockerNetworks(...a),
}));

const { Docker } = await import('./Docker');

function node(over: Partial<Node> = {}): Node {
  return {
    id: 'n1',
    name: 'web-1',
    hostname: '',
    address: '10.0.0.5',
    port: 22,
    ssh_username: 'deploy',
    auth_kind: 'private_key',
    ssh_key_id: null,
    project_id: null,
    os: null,
    distro: null,
    distro_version: null,
    status: 'reachable',
    tags: [],
    last_discovered_at: null,
    created_at: '2026-07-30T22:12:00Z',
    ...over,
  };
}

function container(over: Partial<DockerContainer> = {}): DockerContainer {
  return {
    full_id: 'f'.repeat(64),
    id: 'f0f0f0f0f0f0',
    name: 'api',
    image: 'ghcr.io/acme/api:1.4.0',
    image_id: 'sha256:aaa',
    state: 'running',
    status_text: 'Up 3 hours',
    health: 'healthy',
    created_at: '2026-09-08T09:00:00Z',
    started_at: '2026-09-08T09:00:00Z',
    restart_count: 0,
    restart_policy: 'unless-stopped',
    ports: [],
    ownership: 'slideops',
    networks: ['bridge'],
    mount_count: 0,
    labels: {},
    ...over,
  };
}

function stat(over: Partial<DockerStats> = {}): DockerStats {
  return {
    container_id: 'f'.repeat(64),
    cpu_percent: 12,
    memory_used_mb: 340,
    memory_limit_mb: 64000,
    net_rx_bytes: 0,
    net_tx_bytes: 0,
    block_read_bytes: 0,
    block_write_bytes: 0,
    pids: 9,
    ...over,
  };
}

function overview(over: Partial<DockerOverview> = {}): DockerOverview {
  return {
    daemon: {
      available: true,
      version: '27.1.1',
      api_version: '1.46',
      storage_driver: 'overlay2',
      cgroup_driver: 'systemd',
      warnings: [],
    },
    counts: {
      containers: 1,
      running: 1,
      stopped: 0,
      paused: 0,
      restarting: 0,
      unhealthy: 0,
      exited: 0,
      dead: 0,
      created: 0,
      images: 4,
      volumes: 2,
      networks: 3,
      compose_projects: 1,
    },
    disk: {
      images: { count: 0, active: 0, bytes_total: 2_000_000_000, bytes_reclaimable: 500_000_000 },
      containers: { count: 0, active: 0, bytes_total: 10_000_000, bytes_reclaimable: 0 },
      volumes: { count: 0, active: 0, bytes_total: 1_000_000_000, bytes_reclaimable: 0 },
      build_cache: {
        count: 0,
        active: 0,
        bytes_total: 300_000_000,
        bytes_reclaimable: 300_000_000,
      },
    },
    ...over,
  };
}

/** Render the screen at one route, so the tab and Node params are under test control. */
function show(route = '/app/docker?tab=containers') {
  return renderInApp(
    <MemoryRouter initialEntries={[route]}>
      <Docker />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  for (const fn of [
    listNodes,
    getDockerOverview,
    listDockerContainers,
    listDockerStats,
    listDockerImages,
    listDockerVolumes,
    listDockerNetworks,
  ]) {
    fn.mockReset();
  }
  useWorkspaceStore.setState({
    workspaces: [{ id: 'ws-1', name: 'W', role: 'owner', active: true } as never],
  });
  listNodes.mockResolvedValue([node()]);
  getDockerOverview.mockResolvedValue(overview());
  listDockerContainers.mockResolvedValue([container()]);
  listDockerStats.mockResolvedValue([stat()]);
  listDockerImages.mockResolvedValue([]);
  listDockerVolumes.mockResolvedValue([]);
  listDockerNetworks.mockResolvedValue([]);
});

describe('Docker', () => {
  it('lists the containers on the selected Node', async () => {
    show();

    expect(await screen.findByText('api')).toBeInTheDocument();
    expect(screen.getByText('ghcr.io/acme/api:1.4.0')).toBeInTheDocument();
    expect(listDockerContainers).toHaveBeenCalledWith('n1', expect.anything());
  });

  it('reads the Node named in the link rather than the first one', async () => {
    listNodes.mockResolvedValue([node(), node({ id: 'n2', name: 'db-1' })]);
    show('/app/docker?tab=containers&node=n2');

    await screen.findByText('api');
    expect(listDockerContainers).toHaveBeenCalledWith('n2', expect.anything());
  });

  it('says Docker was not detected, naming the Node, instead of showing an error', async () => {
    const absent = new ApiError(409, DOCKER_UNAVAILABLE_CODE, 'Docker is not installed.');
    getDockerOverview.mockRejectedValue(absent);
    listDockerContainers.mockRejectedValue(absent);
    listDockerStats.mockRejectedValue(absent);
    show();

    expect(await screen.findByText('Docker was not detected on web-1')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Enable containers on this server' }),
    ).toBeInTheDocument();
    // A calm empty state, not the red "this did not load" panel.
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('still shows an error panel when the read failed for some other reason', async () => {
    const broken = new ApiError(500, 'internal_error', 'The daemon socket refused the read.');
    getDockerOverview.mockRejectedValue(broken);
    listDockerContainers.mockRejectedValue(broken);
    listDockerStats.mockRejectedValue(broken);
    show();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The daemon socket refused the read.',
    );
    expect(screen.queryByText('Docker was not detected on web-1')).toBeNull();
  });

  it('narrows the list as the Operator searches', async () => {
    listDockerContainers.mockResolvedValue([
      container({ name: 'api' }),
      container({ full_id: 'b'.repeat(64), id: 'b0b0b0b0b0b0', name: 'cache', image: 'redis:7' }),
    ]);
    const operator = userEvent.setup();
    show();

    await screen.findByText('api');
    await operator.type(screen.getByRole('searchbox'), 'redis');

    expect(screen.getByText('cache')).toBeInTheDocument();
    expect(screen.queryByText('api')).toBeNull();
  });

  it('narrows the list by state', async () => {
    listDockerContainers.mockResolvedValue([
      container({ name: 'api', state: 'running' }),
      container({
        full_id: 'c'.repeat(64),
        id: 'c0c0c0c0c0c0',
        name: 'migrate',
        state: 'exited',
        started_at: undefined,
        exit_code: 0,
      }),
    ]);
    const operator = userEvent.setup();
    show();

    await screen.findByText('migrate');
    await operator.selectOptions(screen.getByLabelText('State'), 'exited');

    expect(screen.getByText('migrate')).toBeInTheDocument();
    expect(screen.queryByText('api')).toBeNull();
  });

  it('labels a container SlideOps did not deploy as External', async () => {
    listDockerContainers.mockResolvedValue([
      container({ name: 'legacy-cron', ownership: 'external', service_id: undefined }),
    ]);
    show();

    // Scoped to the card: "External" is also one of the origin filter's own
    // options, and matching that would prove nothing about the container.
    const card = (await screen.findByText('legacy-cron')).closest('div.rounded-md') as HTMLElement;
    expect(within(card).getByText('External')).toBeInTheDocument();
    expect(within(card).queryByText('SlideOps Managed')).toBeNull();
  });

  it('shows no number at all for a container the sampling pass did not cover', async () => {
    listDockerContainers.mockResolvedValue([container({ name: 'api' })]);
    listDockerStats.mockResolvedValue([]);
    show();

    await screen.findByText('api');
    const card = screen.getByText('api').closest('div.rounded-md') as HTMLElement;
    // Two readings, both absent, and neither of them rendered as a zero.
    expect(within(card).getAllByText('--')).toHaveLength(2);
    expect(within(card).queryByText('0%')).toBeNull();
  });

  it('surfaces an unhealthy container in the attention list on Overview', async () => {
    listDockerContainers.mockResolvedValue([
      container({ name: 'api', health: 'unhealthy', status_text: 'Up 3 hours (unhealthy)' }),
    ]);
    show('/app/docker');

    expect(await screen.findByText('api is failing its healthcheck')).toBeInTheDocument();
    expect(screen.queryByText(/Nothing needs attention/)).toBeNull();
  });

  it('says so calmly when nothing needs attention, rather than hiding the section', async () => {
    show('/app/docker');

    expect(await screen.findByText(/Nothing needs attention/)).toBeInTheDocument();
    expect(screen.getByText('27.1.1')).toBeInTheDocument();
  });

  it('offers connecting a server when the Workspace has none', async () => {
    listNodes.mockResolvedValue([]);
    show();

    expect(await screen.findByText('No servers connected yet')).toBeInTheDocument();
    expect(getDockerOverview).not.toHaveBeenCalled();
  });

  it('does not ask the Node for images while a container tab is open', async () => {
    show();

    await screen.findByText('api');
    expect(listDockerImages).not.toHaveBeenCalled();
    expect(listDockerVolumes).not.toHaveBeenCalled();
    expect(listDockerNetworks).not.toHaveBeenCalled();
  });

  it('reads the images only once their tab is opened', async () => {
    listDockerImages.mockResolvedValue([
      {
        id: 'sha256:abc',
        repository: 'ghcr.io/acme/api',
        tag: '1.4.0',
        created_at: '2026-09-01T00:00:00Z',
        size_bytes: 180_000_000,
        dangling: false,
        in_use: true,
        containers: 1,
      },
    ]);
    show('/app/docker?tab=images');

    expect(await screen.findByText('ghcr.io/acme/api:1.4.0')).toBeInTheDocument();
    expect(listDockerImages).toHaveBeenCalledWith('n1', expect.anything());
  });

  it('renders no lifecycle controls, since there is nothing behind them yet', async () => {
    show();

    await screen.findByText('api');
    for (const name of [/^Start$/, /^Stop$/, /^Restart$/, /^Remove$/]) {
      expect(screen.queryByRole('button', { name })).toBeNull();
    }
  });
});

/*
 * The state every Operator sees until an Admin turns the workspace on.
 *
 * The nav entry ships before the flag does, so this is not an edge case: it is
 * what the page looks like on a production deployment that has not opted in,
 * and it must not be a red error about a request that broke.
 */
it('explains itself calmly when the deployment has not enabled the workspace', async () => {
  const notEnabled = new ApiError(404, 'docker_not_enabled', 'not enabled');
  getDockerOverview.mockRejectedValue(notEnabled);
  listDockerContainers.mockRejectedValue(notEnabled);

  show();

  expect(await screen.findByText(/Docker workspace is not enabled here/)).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  // The advice for a server with no Docker is about the wrong problem here.
  expect(screen.queryByText(/Enable containers on this server/)).not.toBeInTheDocument();
});
