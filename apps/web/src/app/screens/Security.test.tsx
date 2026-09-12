import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderInApp } from '../../test/render';
import { useAuthStore } from '../../store/auth';
import { useWorkspaceStore } from '../../store/workspace';

/*
 * Changing a password, from the screen.
 *
 * The behaviour worth pinning is not that the form submits. It is that the
 * current password is genuinely asked for, that a mismatched confirmation never
 * reaches the API, and that an account signing in through GitHub is told it has
 * no password rather than shown a form that could never succeed. All three are
 * silent failures otherwise: the screen looks right in every one of them.
 */

const changePassword = vi.fn();

// The shell reloads the Workspace list as it mounts, so the list the profile
// reads is served here rather than only seeded into the store.
// Hoisted, because vi.mock runs before this module's own declarations do.
const workspacesFixture = vi.hoisted(() => [
  { id: 'ws_1', name: 'Personal', is_personal: true, role: 'owner' as const, active: false },
  { id: 'ws_2', name: 'Acme Labs', is_personal: true, role: 'viewer' as const, active: true },
]);

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  changePassword: (input: unknown) => changePassword(input),
  listWorkspaces: () => Promise.resolve(workspacesFixture),
  mfaSetup: vi.fn(),
  mfaEnable: vi.fn(),
  mfaDisable: vi.fn(),
}));

const { Security } = await import('./Security');

interface Account {
  id: string;
  email: string;
  role: 'operator' | 'admin';
  tier?: 'free' | 'starter' | 'pro' | 'enterprise';
  mfa_enabled: boolean;
  has_password: boolean;
  github_login?: string;
  created_at: string;
}

const account: Account = {
  id: 'op_1',
  email: 'ada@example.com',
  role: 'operator',
  tier: 'pro',
  mfa_enabled: false,
  has_password: true,
  created_at: '2026-07-26T09:30:00Z',
};

function signedInAs(operator: Account) {
  useAuthStore.setState({ operator, status: 'authenticated' });
}

function renderScreen() {
  return renderInApp(
    <MemoryRouter>
      <Security />
    </MemoryRouter>,
  );
}

describe('Security: profile', () => {
  beforeEach(() => {
    signedInAs(account);
    useWorkspaceStore.setState({ workspaces: workspacesFixture, loaded: true });
  });

  /** The value beside a label in the profile list. */
  function row(label: string) {
    return within(screen.getByText(label, { selector: 'dt' }).parentElement!);
  }

  it('shows who the account is, its plan, and how it signs in', async () => {
    renderScreen();
    expect(await screen.findByRole('heading', { name: 'Profile' })).toBeInTheDocument();
    expect(row('Email').getByText('ada@example.com')).toBeInTheDocument();
    expect(row('Account ID').getByText('op_1')).toBeInTheDocument();
    expect(row('Plan').getByText('Pro')).toBeInTheDocument();
    expect(row('Signs in with').getByText('Password')).toBeInTheDocument();
    expect(row('Member since').getByText(/2026/)).toBeInTheDocument();
  });

  // The role comes from the membership, never from whether the Workspace is
  // somebody's Personal one: a Viewer in another Operator's Personal Workspace
  // is still a Viewer there.
  it('lists every Workspace with the role held in it, and marks the active one', async () => {
    renderScreen();
    const list = await waitFor(() => row('Workspaces'));
    expect(list.getByText('Acme Labs')).toBeInTheDocument();
    expect(list.getByText('Viewer')).toBeInTheDocument();
    expect(list.getByText('Owner')).toBeInTheDocument();
    expect(list.getByText('Active now')).toBeInTheDocument();
  });

  it('names GitHub as the way in for an account that signs in with it', async () => {
    signedInAs({ ...account, has_password: false, github_login: 'ada' });
    renderScreen();
    expect(await screen.findByText('GitHub (@ada)')).toBeInTheDocument();
  });

  it('says when the account can reach the admin control plane', async () => {
    signedInAs({ ...account, role: 'admin', mfa_enabled: true });
    renderScreen();
    expect(
      (await screen.findAllByText('Operator, with access to the admin control plane')).length,
    ).toBeGreaterThan(0);
  });

  it('no longer shows the deployment details', async () => {
    renderScreen();
    await screen.findByRole('heading', { name: 'Profile' });
    expect(screen.queryByText('This deployment')).not.toBeInTheDocument();
    expect(screen.queryByText('API base')).not.toBeInTheDocument();
  });
});

describe('Security: password', () => {
  beforeEach(() => {
    changePassword.mockReset();
    signedInAs(account);
  });

  it('sends the current and the new password, and reports what it cost', async () => {
    changePassword.mockResolvedValue({ changed: true, sessions_ended: 2 });
    const operator = userEvent.setup();
    renderScreen();

    await operator.type(screen.getByLabelText('Current password'), 'correct-horse-battery');
    await operator.type(screen.getByLabelText('New password'), 'a-different-long-one');
    await operator.type(screen.getByLabelText('Confirm new password'), 'a-different-long-one');
    await operator.click(screen.getByRole('button', { name: 'Change password' }));

    await waitFor(() =>
      expect(changePassword).toHaveBeenCalledWith({
        current_password: 'correct-horse-battery',
        new_password: 'a-different-long-one',
      }),
    );
    // The count is the reassurance: anyone else holding the old password is out.
    expect(await screen.findByRole('status')).toHaveTextContent(/2 other sessions were signed out/);
  });

  it('does not call the API when the confirmation does not match', async () => {
    const operator = userEvent.setup();
    renderScreen();

    await operator.type(screen.getByLabelText('Current password'), 'correct-horse-battery');
    await operator.type(screen.getByLabelText('New password'), 'a-different-long-one');
    await operator.type(screen.getByLabelText('Confirm new password'), 'something-else-entirely');
    await operator.click(screen.getByRole('button', { name: 'Change password' }));

    expect(await screen.findByText('The passwords do not match.')).toBeInTheDocument();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('refuses to submit a new password that is the current one', async () => {
    const operator = userEvent.setup();
    renderScreen();

    await operator.type(screen.getByLabelText('Current password'), 'correct-horse-battery');
    await operator.type(screen.getByLabelText('New password'), 'correct-horse-battery');
    await operator.type(screen.getByLabelText('Confirm new password'), 'correct-horse-battery');
    await operator.click(screen.getByRole('button', { name: 'Change password' }));

    expect(
      await screen.findByText('Choose a password different from your current one.'),
    ).toBeInTheDocument();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('holds the new password to the length rule before sending it', async () => {
    const operator = userEvent.setup();
    renderScreen();

    await operator.type(screen.getByLabelText('Current password'), 'correct-horse-battery');
    await operator.type(screen.getByLabelText('New password'), 'short');
    await operator.type(screen.getByLabelText('Confirm new password'), 'short');
    await operator.click(screen.getByRole('button', { name: 'Change password' }));

    expect(await screen.findByText('Use at least 12 characters.')).toBeInTheDocument();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('shows what the server said when it refuses the change', async () => {
    const { ApiError } = await import('@slideops/api-client');
    changePassword.mockRejectedValue(
      new ApiError(401, 'invalid_credentials', 'your current password is incorrect'),
    );
    const operator = userEvent.setup();
    renderScreen();

    await operator.type(screen.getByLabelText('Current password'), 'not-the-password');
    await operator.type(screen.getByLabelText('New password'), 'a-different-long-one');
    await operator.type(screen.getByLabelText('Confirm new password'), 'a-different-long-one');
    await operator.click(screen.getByRole('button', { name: 'Change password' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'your current password is incorrect',
    );
  });

  // A form that could never succeed is worse than no form.
  it('tells a GitHub account it has no password, rather than offering the form', async () => {
    signedInAs({ ...account, has_password: false });
    renderScreen();

    expect(await screen.findByText(/no password to change/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Current password')).not.toBeInTheDocument();
  });
});
