import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderInApp } from '../../test/render';

/*
 * The Service detail page, as a whole.
 *
 * The sections were tested one at a time and the page they live on was not, so
 * "the logs are not on the Service page" was a claim nothing in the suite could
 * confirm or deny. This renders the real screen with the real providers and
 * asserts what is actually on it.
 */

const getService = vi.fn();
const getProject = vi.fn();
const getNode = vi.fn();
const getServiceActivity = vi.fn();
const getServiceMetrics = vi.fn();
const listCapabilityActions = vi.fn();
const checkServiceUpdate = vi.fn();
const purgeService = vi.fn();
const listMarketplacePlugins = vi.fn();
const listInstalledPlugins = vi.fn();
const getCapabilityStates = vi.fn();
const getOperation = vi.fn();
const listCapabilities = vi.fn();
const addServiceCapability = vi.fn();

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getService: (...a: unknown[]) => getService(...a),
  getProject: (...a: unknown[]) => getProject(...a),
  getNode: (...a: unknown[]) => getNode(...a),
  getServiceActivity: (...a: unknown[]) => getServiceActivity(...a),
  getServiceMetrics: (...a: unknown[]) => getServiceMetrics(...a),
  listCapabilityActions: (...a: unknown[]) => listCapabilityActions(...a),
  checkServiceUpdate: (...a: unknown[]) => checkServiceUpdate(...a),
  purgeService: (...a: unknown[]) => purgeService(...a),
  listMarketplacePlugins: (...a: unknown[]) => listMarketplacePlugins(...a),
  listInstalledPlugins: (...a: unknown[]) => listInstalledPlugins(...a),
  getCapabilityStates: (...a: unknown[]) => getCapabilityStates(...a),
  getOperation: (...a: unknown[]) => getOperation(...a),
  listCapabilities: (...a: unknown[]) => listCapabilities(...a),
  addServiceCapability: (...a: unknown[]) => addServiceCapability(...a),
}));

const { ServiceDetail } = await import('./ServiceDetail');

// The Logs tab opens a live websocket the moment it is on screen, which it is
// by default. A websocket the test drives, standing in for the browser's, so
// what streams down it is deterministic instead of a real network call.
class FakeSocket {
  static last: FakeSocket | null = null;
  static readonly OPEN = 1;

  readyState = 0;
  private listeners: Record<string, Array<(event: unknown) => void>> = {};

  constructor(public url: string) {
    FakeSocket.last = this;
  }

  addEventListener(type: string, handler: (event: unknown) => void) {
    (this.listeners[type] ??= []).push(handler);
  }

  close() {
    this.readyState = 3;
  }

  emit(type: string, event: unknown) {
    for (const handler of this.listeners[type] ?? []) {
      handler(event);
    }
  }

  openIt() {
    this.readyState = FakeSocket.OPEN;
    this.emit('open', {});
  }

  message(data: unknown) {
    this.emit('message', { data: JSON.stringify(data) });
  }
}

const service = {
  id: 'svc-1',
  operator_id: 'op-1',
  project_id: 'p-1',
  node_id: 'n-1',
  name: 'prudent-journal-backend',
  runtime: 'container',
  status: 'running',
  source: { type: 'repository', repository_url: 'https://github.com/x/y', branch: 'main' },
  cpu_limit: 1,
  memory_mb: 512,
  pids_limit: 256,
  env: { APP_ENV: 'production', DATABASE_URL: '[stored securely]' },
  ports: [{ host: 8100, container: 8000 }],
  adopted: false,
  created_at: '2026-07-30T10:00:00Z',
};

function show() {
  return renderInApp(
    <MemoryRouter initialEntries={['/app/services/svc-1']}>
      <Routes>
        <Route path="/app/services/:id" element={<ServiceDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ServiceDetail', () => {
  beforeEach(() => {
    FakeSocket.last = null;
    vi.stubGlobal('WebSocket', FakeSocket as unknown as typeof WebSocket);
    getService.mockReset().mockResolvedValue(service);
    getProject.mockReset().mockResolvedValue({ id: 'p-1', name: 'Kenpoly' });
    getNode.mockReset().mockResolvedValue({ id: 'n-1', name: 'contabo vps' });
    getServiceActivity.mockReset().mockResolvedValue([
      {
        id: 'a1',
        kind: 'deploy.succeeded',
        message: 'Deployed, and the Service is running.',
        outcome: 'ok',
        detail: { commit: '4f2a1c9e' },
        created_at: '2026-07-31T09:00:00Z',
      },
    ]);
    getServiceMetrics.mockReset().mockResolvedValue({
      cpu_percent: 2,
      memory_used_mb: 90,
      memory_limit_mb: 512,
    });
    // Manage renders nothing when the Capability offers no Actions, which is the
    // adaptive rule working. It needs one to be on the page at all.
    listCapabilityActions.mockReset().mockResolvedValue([
      {
        key: 'list-databases',
        label: 'Databases',
        description: 'Every database this Service uses.',
        effect: 'read',
        produces: 'table',
        parameters: [],
      },
    ]);
    checkServiceUpdate.mockReset().mockResolvedValue({ behind: false });
    purgeService.mockReset().mockResolvedValue(undefined);
    listMarketplacePlugins.mockReset().mockResolvedValue([
      {
        id: 'postgresql',
        name: 'PostgreSQL',
        version: '1.0.0',
        author: 'SlideOps',
        category: 'database',
        description: 'A PostgreSQL server.',
        provides: ['install-postgresql'],
        config: [],
        permissions: [],
        installed: true,
      },
    ]);
    listInstalledPlugins.mockReset().mockResolvedValue([
      { id: 'inst-1', plugin_id: 'postgresql', enabled: true, installed_at: '2026-01-01' },
    ]);
    getCapabilityStates.mockReset().mockResolvedValue({
      'install-postgresql': {
        status: 'done',
        source: 'slideops',
        last_operation_id: 'op-1',
        last_completed_at: '2026-01-01T00:00:00Z',
      },
    });
    getOperation.mockReset().mockResolvedValue({
      id: 'op-1',
      node_id: 'n-1',
      capability_key: 'install-postgresql',
      status: 'completed',
      plan: null,
      verification: null,
      error: null,
      parameters: {},
      created_at: '2026-01-01T00:00:00Z',
      approved_at: null,
      started_at: null,
      completed_at: '2026-01-01T00:00:00Z',
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // The claim that keeps coming back: there is no log console on the Service.
  it('shows the logs section, open, live, with the workload output in it', async () => {
    show();

    await userEvent.click(await screen.findByRole('tab', { name: 'Logs' }));

    await screen.findByRole('log');
    FakeSocket.last!.openIt();
    FakeSocket.last!.message({ type: 'history', data: 'listening on :8000\nready' });

    expect(await screen.findByRole('log')).toHaveTextContent('listening on :8000');
    FakeSocket.last!.message({ type: 'log', data: 'a request came in' });
    await waitFor(() => expect(screen.getByRole('log')).toHaveTextContent('a request came in'));
  });

  it('shows the activity trail beside the output', async () => {
    show();

    await userEvent.click(await screen.findByRole('tab', { name: 'Logs' }));
    await userEvent.click(await screen.findByRole('tab', { name: 'Activity' }));

    expect(await screen.findByText('Deployed, and the Service is running.')).toBeInTheDocument();
    expect(screen.getByText(/4f2a1c9/)).toBeInTheDocument();
  });

  /*
   * The sections that remain foldable now that each lives on its own tab
   * rather than competing with everything else on one long page. Each is
   * checked by its disclosure button, which is what actually makes it
   * foldable: a heading that merely looks like one is the failure being
   * guarded against.
   */
  it.each([
    ['Live usage', 'Overview' as const],
    ['Manage', 'Browse' as const],
    ['Command and environment', 'Settings' as const],
  ])('lets the Operator fold %s', async (title, tab) => {
    show();

    if (tab !== 'Overview') {
      await userEvent.click(await screen.findByRole('tab', { name: tab }));
    }

    // Anchored, because a guidance tooltip beside a heading is also a button
    // with aria-expanded and its name mentions the same section. Every one of
    // these starts open on its own tab now: an Operator who navigated here
    // asked for exactly this, so nothing should greet them collapsed.
    const toggle = await screen.findByRole('button', { name: new RegExp('^' + title) });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await userEvent.click(toggle);
    await waitFor(() => expect(toggle).toHaveAttribute('aria-expanded', 'false'));

    await userEvent.click(toggle);
    await waitFor(() => expect(toggle).toHaveAttribute('aria-expanded', 'true'));
  });

  // Browse used to be hard coded to install-postgresql regardless of what
  // this Service's Project actually has installed. It now asks what is
  // really there and draws whichever real visual manager applies.
  it('shows the real visual manager for whatever is actually installed on Browse', async () => {
    show();
    await userEvent.click(await screen.findByRole('tab', { name: 'Browse' }));

    expect(await screen.findByText('PostgreSQL')).toBeInTheDocument();
    expect(listMarketplacePlugins).toHaveBeenCalledWith(service.project_id, expect.anything());
    expect(getCapabilityStates).toHaveBeenCalledWith(service.node_id, service.project_id, expect.anything());
  });

  it('shows nothing to browse when the Project has nothing with a visual manager installed', async () => {
    listMarketplacePlugins.mockResolvedValue([]);
    getCapabilityStates.mockResolvedValue({});
    show();
    await userEvent.click(await screen.findByRole('tab', { name: 'Browse' }));

    expect(await screen.findByText('Nothing to browse yet')).toBeInTheDocument();
  });

  // Settings used to show only the Service's own env and resource
  // configuration, with no way to find a database password or a master key
  // without already knowing which Capability page it lived on.
  it('shows an installed app’s credentials on Settings', async () => {
    show();
    await userEvent.click(await screen.findByRole('tab', { name: 'Settings' }));

    expect(await screen.findByText('Installed apps')).toBeInTheDocument();
    expect(await screen.findByText('PostgreSQL')).toBeInTheDocument();
    expect(getOperation).toHaveBeenCalledWith('op-1', expect.anything());
  });

  // Leaving the Logs tab must actually stop the log view, not merely hide it,
  // or the open websocket behind it carries on regardless of what is on screen.
  it('takes the output away when the Logs tab is left', async () => {
    show();

    await userEvent.click(await screen.findByRole('tab', { name: 'Logs' }));
    expect(await screen.findByRole('log')).toBeInTheDocument();

    await userEvent.click(await screen.findByRole('tab', { name: 'Overview' }));
    await waitFor(() => expect(screen.queryByRole('log')).not.toBeInTheDocument());
  });

  // Logs sits ahead of Settings in the tab order, so the section an Operator
  // most often comes looking for when something is wrong is not the one they
  // have to dig past everything else, including their own config editor, to
  // reach.
  it('puts the Logs tab ahead of Settings', async () => {
    show();

    const tabs = (await screen.findAllByRole('tab')).map((tab) => tab.textContent);
    const logs = tabs.findIndex((label) => label === 'Logs');
    const settings = tabs.findIndex((label) => label === 'Settings');

    expect(logs).toBeGreaterThanOrEqual(0);
    expect(settings).toBeGreaterThanOrEqual(0);
    expect(logs).toBeLessThan(settings);
  });

  it('has a Stack tab showing what is installed on this Service, not everything', async () => {
    show();
    const operator = userEvent.setup();

    await operator.click(await screen.findByRole('tab', { name: /Stack/ }));

    expect(await screen.findByText('PostgreSQL')).toBeInTheDocument();
    expect(listMarketplacePlugins).toHaveBeenCalledWith(service.project_id, expect.anything());
  });

  // Purging is the strong, irreversible delete: it must never fire on a
  // mistyped or incomplete confirmation, only on the exact phrase.
  it('deletes the Service forever only once the exact name is typed', async () => {
    show();

    await userEvent.click(
      await screen.findByRole('button', { name: 'Delete this Service forever' }),
    );
    const confirmButton = await screen.findByRole('button', { name: 'Delete forever' });
    expect(confirmButton).toBeDisabled();

    const input = screen.getByLabelText(/Type "delete prudent-journal-backend" to confirm/);
    await userEvent.type(input, 'delete something-else');
    expect(confirmButton).toBeDisabled();

    await userEvent.clear(input);
    await userEvent.type(input, 'delete prudent-journal-backend');
    expect(confirmButton).toBeEnabled();

    await userEvent.click(confirmButton);
    await waitFor(() =>
      expect(purgeService).toHaveBeenCalledWith('svc-1', 'delete prudent-journal-backend'),
    );
  });
});

const capabilityService = {
  ...service,
  deployment_type: 'capability',
  runtime: '',
  source: { type: 'capability' },
  capabilities: [
    { capability_key: 'install-postgresql', operation_id: 'op-1', status: 'done', created_at: '2026-07-30T10:00:00Z' },
    { capability_key: 'install-redis', operation_id: 'op-2', status: 'running', created_at: '2026-07-30T10:01:00Z' },
    { capability_key: 'install-mongodb', operation_id: 'op-3', status: 'failed', created_at: '2026-07-30T10:02:00Z' },
  ],
};

const catalog = [
  { key: 'install-postgresql', name: 'PostgreSQL', category: 'database', description: '', intent: '', risk_level: 'medium', supported_platforms: [], requirements: [], verification_strategy: '', parameters: [] },
  { key: 'install-redis', name: 'Redis', category: 'database', description: '', intent: '', risk_level: 'medium', supported_platforms: [], requirements: [], verification_strategy: '', parameters: [] },
  { key: 'install-mongodb', name: 'MongoDB', category: 'database', description: '', intent: '', risk_level: 'medium', supported_platforms: [], requirements: [], verification_strategy: '', parameters: [] },
  { key: 'install-mariadb', name: 'MariaDB', category: 'database', description: '', intent: '', risk_level: 'medium', supported_platforms: [], requirements: [], verification_strategy: '', parameters: [] },
];

describe('ServiceDetail: a Capability Service', () => {
  beforeEach(() => {
    FakeSocket.last = null;
    vi.stubGlobal('WebSocket', FakeSocket as unknown as typeof WebSocket);
    getService.mockReset().mockResolvedValue(capabilityService);
    getProject.mockReset().mockResolvedValue({ id: 'p-1', name: 'Kenpoly' });
    getNode.mockReset().mockResolvedValue({ id: 'n-1', name: 'contabo vps' });
    getServiceActivity.mockReset().mockResolvedValue([]);
    listCapabilityActions.mockReset().mockResolvedValue([]);
    listMarketplacePlugins.mockReset().mockResolvedValue([]);
    listInstalledPlugins.mockReset().mockResolvedValue([]);
    getCapabilityStates.mockReset().mockResolvedValue({});
    listCapabilities.mockReset().mockResolvedValue(catalog);
    addServiceCapability.mockReset().mockResolvedValue({ ...capabilityService });
  });

  it('shows the tracked capabilities and their status, not resource/build panels', async () => {
    show();
    expect(await screen.findByText('PostgreSQL')).toBeInTheDocument();
    expect(screen.getByText('Redis')).toBeInTheDocument();
    // Nothing software-shaped: no CPU/memory summary rows, no CI/CD tab.
    expect(screen.queryByText('CPU limit')).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /CI\/CD/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Shell/ })).not.toBeInTheDocument();
  });

  it('offers no Start, Stop, or Redeploy actions', async () => {
    show();
    await screen.findByText('PostgreSQL');
    expect(screen.queryByRole('button', { name: 'Start' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Stop' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Redeploy' })).not.toBeInTheDocument();
  });

  it('adds another capability without disturbing what is already tracked', async () => {
    show();
    await screen.findByText('PostgreSQL');
    await userEvent.click(await screen.findByRole('button', { name: /Add Capability/ }));

    // Only the untracked engine is offered -- a failed one (MongoDB) has its
    // own Retry action instead, so it does not show up here too.
    const select = await screen.findByLabelText('Capability');
    expect(select).toHaveValue('install-mariadb');

    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() =>
      expect(addServiceCapability).toHaveBeenCalledWith('svc-1', expect.objectContaining({ capability_key: 'install-mariadb' })),
    );
  });

  it('offers a Retry action only for the capability that failed', async () => {
    show();
    await screen.findByText('PostgreSQL');

    // Exactly one Retry button: MongoDB is the only tracked capability at failed.
    expect(screen.getAllByRole('button', { name: /Retry/ })).toHaveLength(1);

    await userEvent.click(screen.getByRole('button', { name: /Retry/ }));

    await waitFor(() =>
      expect(addServiceCapability).toHaveBeenCalledWith(
        'svc-1',
        expect.objectContaining({ capability_key: 'install-mongodb' }),
      ),
    );
  });
});
