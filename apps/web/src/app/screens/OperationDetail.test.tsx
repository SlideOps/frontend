import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Node, Operation } from '@slideops/api-client';
import { renderInApp } from '../../test/render';

/*
 * The real bug this locks in: when the Node fetch that supplies the
 * credentials card's host and Docker bridge address failed, the failure was
 * swallowed entirely -- an Operator saw a Credentials card with connection
 * strings and even the Host row silently missing, identical to what a Node
 * with no known address looks like, with nothing to tell them a fetch had
 * actually failed or a way to retry it.
 */

const completedOperation: Operation = {
  id: 'op-1',
  node_id: 'node-1',
  capability_key: 'manage-postgresql',
  capability_name: 'Manage PostgreSQL',
  node_name: 'sali-database-server',
  status: 'completed',
  parameters: { database: 'docai', username: 'salidocaidb', password: '[stored securely]' },
  plan: {
    steps: [],
    risks: [],
    rollback: '',
    verification_strategy: '',
  },
  verification: { passed: true, checks: [] },
  error: null,
  created_at: '2026-09-05T21:00:00Z',
  approved_at: '2026-09-05T21:00:00Z',
  started_at: '2026-09-05T21:00:00Z',
  completed_at: '2026-09-05T21:14:18Z',
  events: [],
};

const node: Node = {
  id: 'node-1',
  name: 'sali-database-server',
  hostname: '',
  address: '187.7.20.159',
  port: 22,
  ssh_username: 'root',
  auth_kind: 'password',
  ssh_key_id: null,
  project_id: null,
  os: 'Ubuntu',
  distro: 'ubuntu',
  distro_version: '22.04',
  status: 'reachable',
  tags: [],
  last_discovered_at: null,
  created_at: '2026-09-05T20:00:00Z',
};

// jsdom has no matchMedia, and the live terminal this screen mounts (xterm)
// reads it to pick its device pixel ratio. Every other screen test avoids
// this by never mounting a status that renders the terminal; this is the
// first to render OperationDetail whole, so the gap belongs here rather than
// in the shared setup other, terminal-free tests do not need.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

const getNodeMock = vi.fn();

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getOperation: vi.fn(async () => completedOperation),
  getNode: (...args: [string]) => getNodeMock(...args),
  openOperationStream: vi.fn(() => ({ close: vi.fn() })),
}));

const { OperationDetail } = await import('./OperationDetail');

function show() {
  return renderInApp(
    <MemoryRouter initialEntries={['/operations/op-1']}>
      <Routes>
        <Route path="/operations/:id" element={<OperationDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  getNodeMock.mockReset();
});

describe('OperationDetail credentials host resolution', () => {
  it('shows a retry notice, not silence, when the Node fetch fails', async () => {
    getNodeMock.mockRejectedValue(new Error('network error'));
    show();

    await screen.findByText(/could not load this node's address/i);
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('retrying a failed Node fetch clears the notice once it succeeds', async () => {
    getNodeMock.mockRejectedValueOnce(new Error('network error'));
    getNodeMock.mockResolvedValueOnce(node);
    show();

    await screen.findByText(/could not load this node's address/i);
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => {
      expect(screen.queryByText(/could not load this node's address/i)).not.toBeInTheDocument();
    });
    expect(getNodeMock).toHaveBeenCalledTimes(2);
  });

  it('shows no failure notice once the Node loads successfully', async () => {
    getNodeMock.mockResolvedValue(node);
    show();

    await screen.findByRole('heading', { name: 'Credentials' });
    await waitFor(() => expect(getNodeMock).toHaveBeenCalledWith('node-1'));
    expect(screen.queryByText(/could not load this node's address/i)).not.toBeInTheDocument();
  });
});
