import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Node, Service } from '@slideops/api-client';
import { renderInApp } from '../../test/render';

// Same stand-ins as ShellTabs.test.tsx: what is under test is which target a
// tab connects to, not how xterm renders.
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

class FakeSocket {
  static all: FakeSocket[] = [];
  static readonly OPEN = 1;
  readyState = 0;
  binaryType = '';
  sent: unknown[] = [];
  private listeners: Record<string, Array<(event: unknown) => void>> = {};

  constructor(public url: string) {
    FakeSocket.all.push(this);
  }

  addEventListener(type: string, handler: (event: unknown) => void) {
    (this.listeners[type] ??= []).push(handler);
  }

  send(data: unknown) {
    this.sent.push(data);
  }

  close() {
    this.readyState = 3;
    this.emit('close', {});
  }

  emit(type: string, event: unknown) {
    for (const handler of this.listeners[type] ?? []) {
      handler(event);
    }
  }
}

const webNode: Node = {
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
};

const runningService = {
  id: 's1',
  name: 'api',
  project_id: 'p1',
  runtime: 'container',
  status: 'running',
  source: { type: 'image', image: 'node:20-alpine' },
} as Service;

const stoppedService = {
  id: 's2',
  name: 'worker',
  project_id: 'p1',
  runtime: 'container',
  status: 'stopped',
  source: { type: 'image', image: 'redis:7-alpine' },
} as Service;

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  listNodes: async () => [webNode],
  listServices: async () => [runningService, stoppedService],
  listProjects: async () => [{ id: 'p1', name: 'Prudent Journal' }],
  nodeShellUrl: (id: string, cols: number, rows: number) => `ws://test/nodes/${id}?cols=${cols}&rows=${rows}`,
  serviceShellUrl: (id: string, cols: number, rows: number) => `ws://test/services/${id}?cols=${cols}&rows=${rows}`,
}));

const { Terminal } = await import('./Terminal');

beforeEach(() => {
  FakeSocket.all = [];
  vi.stubGlobal('WebSocket', FakeSocket as unknown as typeof WebSocket);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function render() {
  return renderInApp(
    <MemoryRouter>
      <Terminal />
    </MemoryRouter>,
  );
}

describe('Terminal', () => {
  it('opens the picker and lists servers and Services grouped by Project', async () => {
    render();
    await userEvent.click(screen.getByRole('button', { name: /open a shell on/i }));

    await screen.findByText('web-1');
    expect(screen.getByText('api')).toBeInTheDocument();
    expect(screen.getByText('worker')).toBeInTheDocument();
    // web-1 has no Project, so it groups under Unassigned; api/worker under Prudent Journal.
    expect(screen.getByText('Unassigned')).toBeInTheDocument();
    expect(screen.getByText('Prudent Journal')).toBeInTheDocument();
  });

  it('picking a Node opens a tab that connects to that Node’s own shell URL', async () => {
    render();
    await userEvent.click(screen.getByRole('button', { name: /open a shell on/i }));
    await userEvent.click(await screen.findByText('web-1'));

    // Anchored so it cannot also match the picker trigger, "Open a shell on…".
    await userEvent.click(await screen.findByRole('button', { name: /^Open a shell \(/i }));
    await waitFor(() => expect(FakeSocket.all).toHaveLength(1));
    expect(FakeSocket.all[0]!.url).toMatch(/^ws:\/\/test\/nodes\/n1\?/);
  });

  it('picking a stopped Service opens a tab that refuses to connect, with the reason', async () => {
    render();
    await userEvent.click(screen.getByRole('button', { name: /open a shell on/i }));
    await userEvent.click(await screen.findByText('worker'));

    expect(await screen.findByText(/this service is stopped/i)).toBeInTheDocument();
    const openButton = await screen.findByRole('button', { name: /^Open a shell \(/i });
    expect(openButton).toBeDisabled();
    expect(FakeSocket.all).toHaveLength(0);
  });

  it('opening a second target does not touch the first tab’s session', async () => {
    render();
    await userEvent.click(screen.getByRole('button', { name: /open a shell on/i }));
    await userEvent.click(await screen.findByText('web-1'));
    await userEvent.click(await screen.findByRole('button', { name: /^Open a shell \(/i }));
    await waitFor(() => expect(FakeSocket.all).toHaveLength(1));

    await userEvent.click(screen.getByRole('button', { name: /open a shell on/i }));
    await userEvent.click(await screen.findByText('api'));
    await userEvent.click(await screen.findByRole('button', { name: /^Open a shell \(/i }));
    await waitFor(() => expect(FakeSocket.all).toHaveLength(2));

    expect(FakeSocket.all[1]!.url).toMatch(/^ws:\/\/test\/services\/s1\?/);
  });
});
