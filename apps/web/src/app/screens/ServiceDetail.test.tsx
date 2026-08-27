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

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getService: (...a: unknown[]) => getService(...a),
  getProject: (...a: unknown[]) => getProject(...a),
  getNode: (...a: unknown[]) => getNode(...a),
  getServiceActivity: (...a: unknown[]) => getServiceActivity(...a),
  getServiceMetrics: (...a: unknown[]) => getServiceMetrics(...a),
  listCapabilityActions: (...a: unknown[]) => listCapabilityActions(...a),
  checkServiceUpdate: (...a: unknown[]) => checkServiceUpdate(...a),
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
});
