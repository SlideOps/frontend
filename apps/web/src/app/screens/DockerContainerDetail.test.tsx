import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DockerContainer, DockerInspect, DockerStats, Node } from '@slideops/api-client';
import { renderInApp } from '../../test/render';
import { useWorkspaceStore } from '../../store/workspace';

/*
 * The container detail page, tested through what an Operator sees.
 *
 * The rules worth pinning are the ones this page would be dishonest without: a
 * container id means nothing without the server whose daemon issued it, a
 * reading nobody took is a dash and never a zero, a meter is only drawn where a
 * real ceiling exists, and a chart never claims history SlideOps did not watch.
 *
 * Polling is deliberately not asserted. Its cadence is a timer around a hook
 * that keeps its data across a refetch, so a test of it asserts almost nothing
 * while being the first thing to go flaky in CI.
 */

// The Terminal tab pulls xterm in through this screen's imports, and xterm
// reaches for a canvas the moment it loads, which jsdom does not have. Stubbed
// so importing the screen does not depend on a renderer nothing here tests.
vi.mock('@xterm/xterm', () => ({
  Terminal: class {
    cols = 100;
    rows = 30;
    options: Record<string, unknown> = {};
    loadAddon() {}
    open() {}
    write() {}
    focus() {}
    dispose() {}
    onData() {}
    onResize() {}
  },
}));
vi.mock('@xterm/addon-fit', () => ({
  FitAddon: class {
    fit() {}
  },
}));
vi.mock('@xterm/xterm/css/xterm.css', () => ({}));

const getNode = vi.fn();
const listDockerContainers = vi.fn();
const listDockerStats = vi.fn();
const inspectDockerContainer = vi.fn();
const getSavedDiscovery = vi.fn();

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getNode: (...a: unknown[]) => getNode(...a),
  listDockerContainers: (...a: unknown[]) => listDockerContainers(...a),
  listDockerStats: (...a: unknown[]) => listDockerStats(...a),
  inspectDockerContainer: (...a: unknown[]) => inspectDockerContainer(...a),
  getSavedDiscovery: (...a: unknown[]) => getSavedDiscovery(...a),
}));

const { DockerContainerDetail } = await import('./DockerContainerDetail');

const FULL_ID = 'f'.repeat(64);

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
    full_id: FULL_ID,
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
    container_id: FULL_ID,
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

function inspect(over: Partial<DockerInspect> = {}): DockerInspect {
  return {
    general: {
      full_id: FULL_ID,
      id: FULL_ID.slice(0, 12),
      name: '/api',
      created_at: '2026-09-08T09:00:00Z',
      state: 'running',
      status_text: 'Up 3 hours',
      platform: 'linux',
      runtime: 'runc',
      ownership: 'slideops',
    },
    configuration: {
      image: 'ghcr.io/acme/api:1.4.0',
      command: ['node', 'server.js'],
      entrypoint: [],
      working_dir: '/app',
      user: '',
      labels: {},
    },
    resources: {
      cpu_limit_cores: 0,
      cpu_shares: 0,
      memory_limit_mb: 0,
      memory_reservation_mb: 0,
      pids_limit: 0,
    },
    networking: {
      networks: [{ name: 'bridge', ip_address: '172.17.0.4', aliases: [] }],
      ports: [{ container_port: 80, protocol: 'tcp', host_port: 8080 }],
      dns: [],
      hostname: 'f0f0f0f0f0f0',
    },
    storage: {
      mounts: [
        {
          type: 'volume',
          source: '/var/lib/docker/volumes/api-data/_data',
          destination: '/data',
          read_only: false,
          name: 'api-data',
        },
      ],
    },
    runtime: {
      restart_policy: 'unless-stopped',
      restart_max_retries: 0,
      restart_count: 0,
      health_failing_streak: 0,
      oom_killed: false,
      pid: 4242,
      exit_code: 0,
    },
    ...over,
  };
}

function show(route = `/app/docker/containers/${FULL_ID}?node=n1`) {
  return renderInApp(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/app/docker/containers/:ref" element={<DockerContainerDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  for (const fn of [
    getNode,
    listDockerContainers,
    listDockerStats,
    inspectDockerContainer,
    getSavedDiscovery,
  ]) {
    fn.mockReset();
  }
  useWorkspaceStore.setState({
    workspaces: [{ id: 'ws-1', name: 'W', role: 'owner', active: true } as never],
  });
  getNode.mockResolvedValue(node());
  listDockerContainers.mockResolvedValue([container()]);
  listDockerStats.mockResolvedValue([stat()]);
  inspectDockerContainer.mockResolvedValue(inspect());
  getSavedDiscovery.mockResolvedValue({ found: false });
});

describe('DockerContainerDetail', () => {
  it('reads the container from the Node the link names', async () => {
    show();

    expect(await screen.findByText('api')).toBeInTheDocument();
    expect(screen.getByText('ghcr.io/acme/api:1.4.0')).toBeInTheDocument();
    expect(screen.getByText('f0f0f0f0f0f0')).toBeInTheDocument();
    expect(screen.getByText('Running')).toBeInTheDocument();
    expect(screen.getByText('Healthy')).toBeInTheDocument();
    expect(listDockerContainers).toHaveBeenCalledWith('n1', expect.anything());
  });

  it('refuses to guess a server when the link does not name one', async () => {
    show(`/app/docker/containers/${FULL_ID}`);

    expect(await screen.findByText('This link does not say which server')).toBeInTheDocument();
    // Reading somebody else's server because the link was short is the one
    // mistake this page must never make.
    expect(listDockerContainers).not.toHaveBeenCalled();
  });

  it('says the container is not on this server rather than showing an empty page', async () => {
    listDockerContainers.mockResolvedValue([]);
    show();

    expect(await screen.findByText('No such container on this server')).toBeInTheDocument();
  });

  it('finds the container by its short id as well as its full one', async () => {
    show('/app/docker/containers/f0f0f0f0f0f0?node=n1');

    expect(await screen.findByText('Up 3 hours')).toBeInTheDocument();
  });

  it('shows a plain reading, not a meter, where the Operator set no limit', async () => {
    show();

    await screen.findByText('api');
    expect(
      screen.getByText('No memory limit set, so this container may use whatever the server has.'),
    ).toBeInTheDocument();
    // The daemon reports the whole machine's memory as the limit for a
    // container that has none, and reading a percentage off that would turn
    // "this server is large" into "this container is fine".
    expect(screen.queryByRole('progressbar', { name: /Memory against its limit/ })).toBeNull();
  });

  it('refuses to invent a denominator when the server has never been discovered', async () => {
    show();

    expect(
      await screen.findByText(/has not read how many cores or how much memory web-1 has/),
    ).toBeInTheDocument();
  });

  it('measures the container against the server once Discovery has read it', async () => {
    getSavedDiscovery.mockResolvedValue({
      found: true,
      facts: { cpu: { cores: 4 }, memory: { total_kb: 16 * 1024 * 1024 } },
    });
    show();

    expect(await screen.findByRole('progressbar', { name: /CPU of web-1/ })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: /Memory of web-1/ })).toBeInTheDocument();
  });

  it('shows a dash, never a zero, for a container no sample covered', async () => {
    listDockerStats.mockResolvedValue([]);
    show();

    expect(
      await screen.findByText(/No live sample covered this container on the last pass/),
    ).toBeInTheDocument();
  });

  it('says plainly that the chart holds only what it watched', async () => {
    show(`/app/docker/containers/${FULL_ID}?node=n1&tab=stats`);

    expect(
      await screen.findByText(/SlideOps keeps no history of container usage/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/no last-hour view because there is no last hour to show/),
    ).toBeInTheDocument();
  });

  it('reads the mounts as what survives removal', async () => {
    show(`/app/docker/containers/${FULL_ID}?node=n1&tab=mounts`);

    expect(await screen.findByText('Named volume')).toBeInTheDocument();
    expect(screen.getByText('Survives removal')).toBeInTheDocument();
    expect(inspectDockerContainer).toHaveBeenCalledWith('n1', FULL_ID, expect.anything());
  });

  it('separates a published port from one that only other containers can reach', async () => {
    show(`/app/docker/containers/${FULL_ID}?node=n1&tab=networks`);

    expect(await screen.findByText('Published to web-1')).toBeInTheDocument();
    expect(screen.getByText('8080 to 80/tcp')).toBeInTheDocument();
    expect(screen.getByText('172.17.0.4')).toBeInTheDocument();
  });

  it('does not read the inspect record for a tab that does not need it', async () => {
    show();

    await screen.findByText('api');
    expect(inspectDockerContainer).not.toHaveBeenCalled();
  });

  it('links to the Service that manages the container, without pretending it is the same page', async () => {
    listDockerContainers.mockResolvedValue([container({ service_id: 'svc-9' })]);
    show();

    const link = await screen.findByRole('link', { name: /Open the Service that manages it/ });
    expect(link).toHaveAttribute('href', '/app/services/svc-9');
  });

  it('keeps the open tab in the link so the page can be shared as it is being read', async () => {
    const operator = userEvent.setup();
    show();

    await screen.findByText('api');
    await operator.click(screen.getByRole('tab', { name: 'Inspect' }));
    expect(await screen.findByText('Configuration')).toBeInTheDocument();
  });
});
