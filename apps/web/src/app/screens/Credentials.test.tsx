import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { renderInApp } from '../../test/render';
import type { Node, Operation } from '@slideops/api-client';

/*
 * Re-running the same Capability on the same Node for the same database
 * (rotating a credential, recreating an account while testing, and so on) is
 * a real, distinct completed Operation every time. Showing every one of them
 * as its own card read as duplicates: three cards all titled "Manage
 * postgresql" for the very same database, differing only by a timestamp
 * nobody was scanning for. Only the latest run of that one database is still
 * the credential that actually applies.
 *
 * A different database on the same Node and Capability is not a duplicate,
 * though: two Services can each run manage-postgresql on the same server and
 * get two different, both real, credentials. Deduping on Node and Capability
 * alone once collapsed those into one and made a stored credential disappear
 * outright, which is worse than an occasional duplicate.
 */

const listOperations = vi.fn();
const listNodes = vi.fn();
const listProjects = vi.fn();
const revealNodeCredential = vi.fn();

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  listOperations: (...a: unknown[]) => listOperations(...a),
  listNodes: (...a: unknown[]) => listNodes(...a),
  listProjects: (...a: unknown[]) => listProjects(...a),
  revealNodeCredential: (...a: unknown[]) => revealNodeCredential(...a),
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
    parameters: { database: 'app_db', password: '[stored securely]' },
    created_at: '2026-07-31T00:00:00Z',
    approved_at: null,
    started_at: null,
    completed_at: '2026-07-31T00:00:00Z',
    ...over,
  };
}

function node(over: Partial<Node> = {}): Node {
  return {
    id: 'n-1',
    name: 'db-server',
    address: '10.0.0.1',
    port: 22,
    ssh_username: 'deploy',
    auth_kind: 'password',
    status: 'active',
    ...over,
  } as Node;
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

  it('keeps two different databases on the same Node and Capability as separate cards', async () => {
    listOperations.mockResolvedValue([
      op({ id: 'op-a', parameters: { database: 'service_a_db', password: '[stored securely]' } }),
      op({ id: 'op-b', parameters: { database: 'service_b_db', password: '[stored securely]' } }),
    ]);
    listNodes.mockResolvedValue([node()]);
    listProjects.mockResolvedValue([]);

    show();

    // Two Services sharing one Postgres server each get their own database
    // and their own credential; neither one is a stale duplicate of the
    // other just because they share a Node and a Capability.
    expect(await screen.findAllByText('Manage postgresql')).toHaveLength(2);
  });
});

/*
 * A Node's own SSH connection credential (what SlideOps itself uses to reach
 * it) is not produced by any Operation, so it never had a card here before.
 * It has to show regardless of whether that Node has ever run a Capability
 * that produced a secret, since a freshly connected Node has none yet and is
 * exactly when an Operator most wants to see how SlideOps is reaching it.
 */
describe('Credentials: Node connections', () => {
  it('shows a Node’s connection details even with no Capability credentials at all', async () => {
    listOperations.mockResolvedValue([]);
    listNodes.mockResolvedValue([node({ name: 'web-1', ssh_username: 'ubuntu' })]);
    listProjects.mockResolvedValue([]);

    show();

    expect(await screen.findByText('web-1')).toBeInTheDocument();
    expect(screen.getByText('ubuntu')).toBeInTheDocument();
  });

  it('reveals the stored secret only once asked, fetched lazily', async () => {
    listOperations.mockResolvedValue([]);
    listNodes.mockResolvedValue([node()]);
    listProjects.mockResolvedValue([]);
    revealNodeCredential.mockResolvedValue({ auth_kind: 'password', secret: 'super-secret-password' });

    show();
    await screen.findByText('db-server');
    expect(revealNodeCredential).not.toHaveBeenCalled();

    const operator = userEvent.setup();
    await operator.click(screen.getByRole('button', { name: /reveal password/i }));

    expect(await screen.findByText('super-secret-password')).toBeInTheDocument();
    expect(revealNodeCredential).toHaveBeenCalledWith('n-1');
  });
});
