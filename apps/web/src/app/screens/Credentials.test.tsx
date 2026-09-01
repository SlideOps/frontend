import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { renderInApp } from '../../test/render';
import type { Node, Operation } from '@slideops/api-client';

/*
 * Re-running the same Capability on the same Node (rotating a database
 * credential, recreating an account while testing, and so on) is a real,
 * distinct completed Operation every time. Showing every one of them as its
 * own card read as duplicates: three cards all titled "Manage postgresql",
 * differing only by a timestamp nobody was scanning for. Only the latest one
 * per Node and Capability is still the credential that actually applies.
 */

const listOperations = vi.fn();
const listNodes = vi.fn();
const listProjects = vi.fn();

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  listOperations: (...a: unknown[]) => listOperations(...a),
  listNodes: (...a: unknown[]) => listNodes(...a),
  listProjects: (...a: unknown[]) => listProjects(...a),
}));

const { Credentials } = await import('./Credentials');

function op(over: Partial<Operation>): Operation {
  return {
    id: 'op-1',
    node_id: 'n-1',
    capability_key: 'manage-postgresql',
    status: 'completed',
    plan: null,
    verification: null,
    error: null,
    parameters: { password: '[stored securely]' },
    created_at: '2026-07-31T00:00:00Z',
    approved_at: null,
    started_at: null,
    completed_at: '2026-07-31T00:00:00Z',
    ...over,
  };
}

function node(over: Partial<Node> = {}): Node {
  return { id: 'n-1', name: 'db-server', address: '10.0.0.1', status: 'active', ...over } as Node;
}

function show() {
  return renderInApp(
    <MemoryRouter>
      <Credentials />
    </MemoryRouter>,
  );
}

describe('Credentials', () => {
  it('shows only the latest run when the same Capability ran on the same Node more than once', async () => {
    listOperations.mockResolvedValue([
      op({ id: 'op-old', completed_at: '2026-07-31T09:29:37Z' }),
      op({ id: 'op-newer', completed_at: '2026-07-31T15:04:45Z' }),
      op({ id: 'op-newest', completed_at: '2026-07-31T20:09:30Z' }),
    ]);
    listNodes.mockResolvedValue([node()]);
    listProjects.mockResolvedValue([]);

    show();

    const titles = await screen.findAllByText('Manage postgresql');
    expect(titles).toHaveLength(1);
  });

  it('keeps credentials from different Nodes or different Capabilities as separate cards', async () => {
    listOperations.mockResolvedValue([
      op({ id: 'op-a', node_id: 'n-1', capability_key: 'manage-postgresql' }),
      op({ id: 'op-b', node_id: 'n-2', capability_key: 'manage-postgresql' }),
      op({ id: 'op-c', node_id: 'n-1', capability_key: 'manage-redis' }),
    ]);
    listNodes.mockResolvedValue([node(), node({ id: 'n-2', name: 'cache-server' })]);
    listProjects.mockResolvedValue([]);

    show();

    // Two different Nodes running the same Capability are two real,
    // distinct credentials, not a duplicate of each other.
    expect(await screen.findAllByText('Manage postgresql')).toHaveLength(2);
    expect(screen.getByText('Manage redis')).toBeInTheDocument();
  });
});
