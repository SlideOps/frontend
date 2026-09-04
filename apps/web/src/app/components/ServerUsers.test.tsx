import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Node, ServerUser } from '@slideops/api-client';
import { renderInApp } from '../../test/render';

/*
 * Server user management: creating an account with a password or a
 * generated private key, and switching which account SlideOps connects
 * with. Create and remove still go through an Operation an Operator
 * approves; switch is the one direct action, verified against the server
 * before anything changes.
 */

const createOperation = vi.fn();
const listNodeUsers = vi.fn();
const switchToServerUser = vi.fn();

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  createOperation: (input: unknown) => createOperation(input),
  listNodeUsers: (...a: unknown[]) => listNodeUsers(...a),
  switchToServerUser: (...a: unknown[]) => switchToServerUser(...a),
}));

const { ServerUsers } = await import('./ServerUsers');

const node = {
  id: 'n1',
  name: 'box',
  address: '10.0.0.1',
  port: 22,
  ssh_username: 'deploy',
} as Node;

function existingUser(overrides: Partial<ServerUser> = {}): ServerUser {
  return {
    username: 'app',
    access_level: 'limited',
    system: false,
    connection: false,
    disabled: false,
    ...overrides,
  };
}

function show(users: ServerUser[] = [], onSwitched?: (updated: Node) => void) {
  listNodeUsers.mockResolvedValue(users);
  return renderInApp(
    <MemoryRouter>
      <ServerUsers nodeId="n1" node={node} onSwitched={onSwitched} />
    </MemoryRouter>,
  );
}

describe('ServerUsers', () => {
  beforeEach(() => {
    createOperation.mockReset();
    createOperation.mockResolvedValue({ id: 'op-1' });
    listNodeUsers.mockReset();
    switchToServerUser.mockReset();
    switchToServerUser.mockResolvedValue({ ...node, ssh_username: 'app' });
  });

  it('shows the active server user', async () => {
    show();
    expect(await screen.findByText('Active server user:')).toBeInTheDocument();
    expect(screen.getByText('deploy')).toBeInTheDocument();
  });

  it('does not hide the private-key option or default the form away from it', async () => {
    show();
    expect(await screen.findByRole('radio', { name: /Password/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Private key/ })).toBeInTheDocument();
  });

  it('creates a password account with the password field visible', async () => {
    const operator = userEvent.setup();
    show();

    await operator.type(await screen.findByLabelText('Username'), 'deploy');
    await operator.type(screen.getByLabelText(/Password \(optional\)/), 's3cret-pass');
    await operator.click(screen.getByRole('button', { name: /Prepare account/ }));

    await waitFor(() =>
      expect(createOperation).toHaveBeenCalledWith({
        node_id: 'n1',
        capability_key: 'manage-server-user',
        parameters: {
          username: 'deploy',
          sudo: false,
          auth_method: 'password',
          password: 's3cret-pass',
        },
      }),
    );
  });

  it('creates a private-key account with no password field and no password sent', async () => {
    const operator = userEvent.setup();
    show();

    await operator.type(await screen.findByLabelText('Username'), 'deploy');
    await operator.click(screen.getByRole('radio', { name: /Private key/ }));

    // Choosing private key removes the password field entirely.
    expect(screen.queryByLabelText(/Password \(optional\)/)).not.toBeInTheDocument();

    await operator.click(screen.getByRole('button', { name: /Prepare account/ }));

    await waitFor(() =>
      expect(createOperation).toHaveBeenCalledWith({
        node_id: 'n1',
        capability_key: 'manage-server-user',
        parameters: {
          username: 'deploy',
          sudo: false,
          auth_method: 'private_key',
        },
      }),
    );
  });

  it('offers Switch for an ordinary account, not for the connection account', async () => {
    show([
      existingUser({ username: 'app' }),
      existingUser({ username: 'slideops', connection: true }),
    ]);

    expect(await screen.findByRole('button', { name: 'Switch to app' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Switch to slideops' })).not.toBeInTheDocument();
  });

  it('switches, verifying first, and reports the new active user', async () => {
    const onSwitched = vi.fn();
    const operator = userEvent.setup();
    show([existingUser({ username: 'app' })], onSwitched);

    await operator.click(await screen.findByRole('button', { name: 'Switch to app' }));
    await operator.click(await screen.findByRole('button', { name: 'Switch' }));

    await waitFor(() => expect(switchToServerUser).toHaveBeenCalledWith('n1', 'app'));
    expect(await screen.findByText(/now connects to this server as app/)).toBeInTheDocument();
    expect(onSwitched).toHaveBeenCalledWith({ ...node, ssh_username: 'app' });
  });

  it('reports a refusal from the server when there is no stored credential to switch to', async () => {
    const { ApiError } = await import('@slideops/api-client');
    switchToServerUser.mockRejectedValue(
      new ApiError(
        409,
        'no_stored_credential',
        'SlideOps holds no generated credential for that server user',
      ),
    );
    const operator = userEvent.setup();
    show([existingUser({ username: 'app' })]);

    await operator.click(await screen.findByRole('button', { name: 'Switch to app' }));
    await operator.click(await screen.findByRole('button', { name: 'Switch' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('no generated credential');
  });
});
