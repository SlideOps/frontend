import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderInApp } from '../../test/render';
import { useAuthStore } from '../../store/auth';

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

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  changePassword: (input: unknown) => changePassword(input),
  mfaSetup: vi.fn(),
  mfaEnable: vi.fn(),
  mfaDisable: vi.fn(),
}));

const { Security } = await import('./Security');

const account = {
  id: 'op_1',
  email: 'ada@example.com',
  role: 'operator' as const,
  mfa_enabled: false,
  has_password: true,
  created_at: 'now',
};

function signedInAs(operator: typeof account) {
  useAuthStore.setState({ operator, status: 'authenticated' });
}

function renderScreen() {
  return renderInApp(
    <MemoryRouter>
      <Security />
    </MemoryRouter>,
  );
}

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
