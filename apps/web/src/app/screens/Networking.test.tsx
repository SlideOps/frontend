import { screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceNetwork } from '@slideops/api-client';
import { renderInApp } from '../../test/render';
import { useWorkspaceStore } from '../../store/workspace';

const getWorkspaceNetwork = vi.fn();
const enableWorkspaceNetwork = vi.fn();
const disableWorkspaceNetwork = vi.fn();
const joinWorkspaceNetwork = vi.fn();
const reconcileWorkspaceNetwork = vi.fn();
const listNodes = vi.fn();

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getWorkspaceNetwork: (...a: unknown[]) => getWorkspaceNetwork(...a),
  enableWorkspaceNetwork: (...a: unknown[]) => enableWorkspaceNetwork(...a),
  disableWorkspaceNetwork: (...a: unknown[]) => disableWorkspaceNetwork(...a),
  joinWorkspaceNetwork: (...a: unknown[]) => joinWorkspaceNetwork(...a),
  reconcileWorkspaceNetwork: (...a: unknown[]) => reconcileWorkspaceNetwork(...a),
  listNodes: (...a: unknown[]) => listNodes(...a),
}));

const { Networking } = await import('./Networking');

/** The screen navigates through its shell, so it needs a router of its own. */
function show() {
  return renderInApp(
    <MemoryRouter>
      <Networking />
    </MemoryRouter>,
  );
}

function network(over: Partial<WorkspaceNetwork> = {}): WorkspaceNetwork {
  return {
    enabled: true,
    address_space: '10.88.0.0/16',
    backend: 'wireguard',
    listen_port: 51820,
    members: [],
    ...over,
  };
}

function asRole(role: 'owner' | 'admin' | 'member' | 'viewer') {
  useWorkspaceStore.setState({
    workspaces: [{ id: 'ws-1', name: 'W', role, active: true } as never],
  });
}

beforeEach(() => {
  for (const fn of [
    getWorkspaceNetwork,
    enableWorkspaceNetwork,
    disableWorkspaceNetwork,
    joinWorkspaceNetwork,
    reconcileWorkspaceNetwork,
    listNodes,
  ]) {
    fn.mockReset();
  }
  listNodes.mockResolvedValue([{ id: 'n-1', name: 'data-node' }]);
  asRole('owner');
});

describe('Networking', () => {
  it('explains what being off costs, rather than only saying it is off', async () => {
    getWorkspaceNetwork.mockResolvedValue(network({ enabled: false }));
    show();

    expect(await screen.findByText(/a firewall rule for every database/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Turn on' })).toBeInTheDocument();
  });

  it('turns the network on', async () => {
    getWorkspaceNetwork.mockResolvedValue(network({ enabled: false }));
    enableWorkspaceNetwork.mockResolvedValue(network());
    show();

    await userEvent.click(await screen.findByRole('button', { name: 'Turn on' }));
    await waitFor(() => expect(enableWorkspaceNetwork).toHaveBeenCalled());
  });

  it('offers a server that is not on the network a way to join', async () => {
    getWorkspaceNetwork.mockResolvedValue(network());
    joinWorkspaceNetwork.mockResolvedValue({});
    show();

    await userEvent.click(await screen.findByRole('button', { name: 'Join' }));
    await waitFor(() => expect(joinWorkspaceNetwork).toHaveBeenCalledWith('n-1'));
  });

  // Pending is work in progress, disabled is a decision, failed is the only one
  // that needs anybody. Collapsing them into "not connected" is what makes a
  // page like this stop being read.
  it('shows why a server failed, and offers a retry only for that one', async () => {
    getWorkspaceNetwork.mockResolvedValue(
      network({
        members: [
          {
            node_id: 'n-1',
            network_address: '10.88.0.1',
            state: 'failed',
            reachable: false,
            last_error: 'the node refused the WireGuard port',
          },
        ],
      }),
    );
    show();

    expect(await screen.findByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('the node refused the WireGuard port')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('does not offer a retry for a server that is simply still joining', async () => {
    getWorkspaceNetwork.mockResolvedValue(
      network({
        members: [
          { node_id: 'n-1', network_address: '10.88.0.1', state: 'pending', reachable: false },
        ],
      }),
    );
    show();

    expect(await screen.findByText('Joining')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });

  // Turning it off breaks anything currently reaching another server privately,
  // so it must not be one click away from done.
  it('warns what turning it off breaks before turning it off', async () => {
    getWorkspaceNetwork.mockResolvedValue(network());
    show();

    await userEvent.click(await screen.findByRole('button', { name: 'Turn off' }));
    expect(await screen.findByText(/will stop working/i)).toBeInTheDocument();
    expect(disableWorkspaceNetwork).not.toHaveBeenCalled();
  });

  it('leaves the controls out for a role that cannot change the network', async () => {
    asRole('member');
    getWorkspaceNetwork.mockResolvedValue(network({ enabled: false }));
    show();

    expect(await screen.findByText(/needs the Owner or an Admin/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Turn on' })).not.toBeInTheDocument();
  });
});
