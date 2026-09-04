import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Node, ServerUser } from '@slideops/api-client';
import { renderInApp } from '../../test/render';

/*
 * The actions on a server account.
 *
 * The modal used to show an account and offer nothing to do with it, so
 * disabling one meant knowing which Capability to go and find. What is pinned
 * here is mostly who is refused: the connection account and system accounts get
 * no actions at all, and root can be disabled but never removed. Getting those
 * wrong offers an Operator a button that ends their own access to the server.
 */

const createOperation = vi.fn();
const switchToServerUser = vi.fn();

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  createOperation: (input: unknown) => createOperation(input),
  revealNodeCredential: vi.fn(),
  switchToServerUser: (...a: unknown[]) => switchToServerUser(...a),
}));

const { ServerAccountModal } = await import('./ServerAccountModal');

const node = { id: 'n1', name: 'box', address: '10.0.0.1', port: 22 } as Node;

function account(overrides: Partial<ServerUser> = {}): ServerUser {
  return {
    username: 'deploy',
    access_level: 'limited',
    system: false,
    connection: false,
    disabled: false,
    ...overrides,
  };
}

function show(user: ServerUser, onSwitched?: (updated: Node) => void) {
  return renderInApp(
    <MemoryRouter>
      <ServerAccountModal
        open
        account={user}
        node={node}
        onClose={() => {}}
        onSwitched={onSwitched}
      />
    </MemoryRouter>,
  );
}

describe('ServerAccountModal actions', () => {
  beforeEach(() => {
    createOperation.mockReset();
    createOperation.mockResolvedValue({ id: 'op-1' });
    switchToServerUser.mockReset();
    switchToServerUser.mockResolvedValue({ ...node, ssh_username: 'deploy' });
  });

  // The Operator's own complaint: Switch must sit right alongside Disable and
  // Remove, every time, never present in one place and missing from another.
  it('always shows Switch alongside Disable and Remove for an ordinary account', async () => {
    show(account());

    expect(
      await screen.findByRole('button', { name: 'Switch to this account' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Disable this account/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Remove this account/ })).toBeInTheDocument();
  });

  it('switches to the account, verifying first, and reports success in the modal', async () => {
    const onSwitched = vi.fn();
    const operator = userEvent.setup();
    show(account(), onSwitched);

    await operator.click(await screen.findByRole('button', { name: 'Switch to this account' }));

    await waitFor(() => expect(switchToServerUser).toHaveBeenCalledWith('n1', 'deploy'));
    expect(await screen.findByText(/now connects to this server as deploy/)).toBeInTheDocument();
    expect(onSwitched).toHaveBeenCalledWith({ ...node, ssh_username: 'deploy' });
  });

  it('reports a refusal to switch rather than looking like it worked', async () => {
    const { ApiError } = await import('@slideops/api-client');
    switchToServerUser.mockRejectedValue(
      new ApiError(
        409,
        'no_stored_credential',
        'SlideOps holds no generated credential for that server user',
      ),
    );
    const operator = userEvent.setup();
    show(account());

    await operator.click(await screen.findByRole('button', { name: 'Switch to this account' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('no generated credential');
  });

  it('starts a disable Operation for an ordinary account', async () => {
    const operator = userEvent.setup();
    show(account());

    await operator.click(await screen.findByRole('button', { name: /Disable this account/ }));

    await waitFor(() =>
      expect(createOperation).toHaveBeenCalledWith({
        node_id: 'n1',
        capability_key: 'disable-server-user',
        parameters: { username: 'deploy' },
      }),
    );
  });

  it('offers enable instead once the account is disabled', async () => {
    const operator = userEvent.setup();
    show(account({ disabled: true }));

    expect(screen.queryByRole('button', { name: /Disable this account/ })).not.toBeInTheDocument();
    await operator.click(await screen.findByRole('button', { name: /Enable this account/ }));

    await waitFor(() =>
      expect(createOperation).toHaveBeenCalledWith(
        expect.objectContaining({ capability_key: 'enable-server-user' }),
      ),
    );
  });

  // Removal is irreversible, so it asks first. The first click must not delete.
  it('confirms before removing, and only then starts the Operation', async () => {
    const operator = userEvent.setup();
    show(account());

    await operator.click(await screen.findByRole('button', { name: /Remove this account/ }));
    expect(createOperation).not.toHaveBeenCalled();

    await operator.click(await screen.findByRole('button', { name: 'Remove permanently' }));
    await waitFor(() =>
      expect(createOperation).toHaveBeenCalledWith(
        expect.objectContaining({ capability_key: 'remove-server-user' }),
      ),
    );
  });

  // root has to exist. Disabling is the whole reason the Capability was added.
  it('lets root be disabled but never removed', async () => {
    show(account({ username: 'root', system: true, access_level: 'admin' }));

    expect(await screen.findByRole('button', { name: /Disable this account/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remove this account/ })).not.toBeInTheDocument();
  });

  // The one that would end SlideOps' own access to the server.
  it('offers nothing for the connection account, and says why', async () => {
    show(account({ username: 'slideops', connection: true }));

    expect(await screen.findByText(/end SlideOps' own access/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Disable this account/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remove this account/ })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Switch to this account' }),
    ).not.toBeInTheDocument();
  });

  it('offers nothing for a system account other than root', async () => {
    show(account({ username: 'www-data', system: true }));

    expect(await screen.findByText(/belongs to the operating system/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Disable this account/ })).not.toBeInTheDocument();
  });

  it('reports a refusal from the server rather than looking like it worked', async () => {
    const { ApiError } = await import('@slideops/api-client');
    createOperation.mockRejectedValue(
      new ApiError(400, 'invalid_request', 'refusing to remove a protected account'),
    );
    const operator = userEvent.setup();
    show(account());

    await operator.click(await screen.findByRole('button', { name: /Disable this account/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('protected account');
  });
});
