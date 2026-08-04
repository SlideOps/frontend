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

    expect(await screen.findByRole('button', { name: /^Logs and activity/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await screen.findByRole('log');
    FakeSocket.last!.openIt();
    FakeSocket.last!.message({ type: 'history', data: 'listening on :8000\nready' });

    expect(await screen.findByRole('log')).toHaveTextContent('listening on :8000');
    FakeSocket.last!.message({ type: 'log', data: 'a request came in' });
    await waitFor(() => expect(screen.getByRole('log')).toHaveTextContent('a request came in'));
  });

  it('shows the activity trail beside the output', async () => {
    show();

    await userEvent.click(await screen.findByRole('tab', { name: 'Activity' }));

    expect(await screen.findByText('Deployed, and the Service is running.')).toBeInTheDocument();
    expect(screen.getByText(/4f2a1c9/)).toBeInTheDocument();
  });

  /*
   * Every section the Operator asked to be able to fold. Each is checked by its
   * disclosure button, which is what actually makes it foldable: a heading that
   * merely looks like one is the failure being guarded against.
   */
  it.each([
    ['Logs and activity', true],
    ['Command and environment', false],
    ['Manage', true],
    ['Shell', false],
    ['Live usage', true],
  ])('lets the Operator fold %s', async (title, startsOpen) => {
    show();

    // Anchored, because a guidance tooltip beside a heading is also a button
    // with aria-expanded and its name mentions the same section.
    const toggle = await screen.findByRole('button', { name: new RegExp('^' + title) });
    expect(toggle).toHaveAttribute('aria-expanded', String(startsOpen));

    await userEvent.click(toggle);
    await waitFor(() => expect(toggle).toHaveAttribute('aria-expanded', String(!startsOpen)));

    await userEvent.click(toggle);
    await waitFor(() => expect(toggle).toHaveAttribute('aria-expanded', String(startsOpen)));
  });

  // Folding the logs away must actually stop showing them, not merely hide them,
  // or the polling and the open connections behind a section carry on.
  it('takes the output away when the logs are folded', async () => {
    show();

    expect(await screen.findByRole('log')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^Logs and activity/ }));
    await waitFor(() => expect(screen.queryByRole('log')).not.toBeInTheDocument());
  });

  // It used to sit at the very bottom, under the whole environment editor, which
  // is a large part of why it read as missing.
  it('puts the logs above the configuration editor', async () => {
    const { container } = show();
    await screen.findByRole('log');

    const headings = Array.from(container.querySelectorAll('section')).map(
      (s) => s.textContent?.slice(0, 40) ?? '',
    );
    const logs = headings.findIndex((h) => h.includes('Logs and activity'));
    const config = headings.findIndex((h) => h.includes('Command and environment'));

    expect(logs).toBeGreaterThanOrEqual(0);
    expect(config).toBeGreaterThanOrEqual(0);
    expect(logs).toBeLessThan(config);
  });
});
