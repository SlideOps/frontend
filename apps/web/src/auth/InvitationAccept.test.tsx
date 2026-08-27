import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Invitation, Operator } from '@slideops/api-client';
import { renderInApp } from '../test/render';
import { useAuthStore } from '../store/auth';
import { useWorkspaceStore } from '../store/workspace';

const invitation: Invitation = { workspace_name: 'Client X', role: 'member' };

const getInvitationMock = vi.fn(async (_token: string) => invitation);
const acceptInvitationMock = vi.fn(async (_token: string) => ({
  id: 'wm_1',
  email: 'me@example.com',
  role: 'member',
  status: 'active',
  invited_at: '2026-08-01T00:00:00Z',
  accepted_at: '2026-08-02T00:00:00Z',
}));

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getInvitation: (...args: [string]) => getInvitationMock(...args),
  acceptInvitation: (...args: [string]) => acceptInvitationMock(...args),
  listWorkspaces: async () => [],
}));

const { InvitationAccept } = await import('./InvitationAccept');

function renderInvitation() {
  return renderInApp(
    <MemoryRouter initialEntries={['/invitations/tok_abc']}>
      <Routes>
        <Route path="/invitations/:token" element={<InvitationAccept />} />
        <Route path="/login" element={<div>the sign in screen</div>} />
        <Route path="/register" element={<div>the sign up screen</div>} />
        <Route path="/app" element={<div>the workspace home</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

const operator: Operator = {
  id: 'op_me',
  email: 'me@example.com',
  role: 'operator',
  mfa_enabled: false,
  has_password: true,
  created_at: 'now',
};

beforeEach(() => {
  getInvitationMock.mockClear();
  acceptInvitationMock.mockClear();
  useWorkspaceStore.setState({ workspaces: [], loaded: false });
  useAuthStore.setState({ status: 'anonymous', operator: null });
});

describe('InvitationAccept', () => {
  it('offers sign in and sign up when nobody is signed in', async () => {
    renderInvitation();
    expect(await screen.findByText(/You were invited to Client X/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign in to accept/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create an account/i })).toBeInTheDocument();
  });

  it('sends an anonymous visitor to sign in and back to this invitation', async () => {
    renderInvitation();
    await userEvent.click(await screen.findByRole('button', { name: /Sign in to accept/i }));
    expect(await screen.findByText('the sign in screen')).toBeInTheDocument();
  });

  it('lets a signed in Operator accept with one click', async () => {
    useAuthStore.setState({ status: 'authenticated', operator });
    renderInvitation();

    const acceptButton = await screen.findByRole('button', { name: /Accept invitation/i });
    await userEvent.click(acceptButton);

    await waitFor(() => expect(acceptInvitationMock).toHaveBeenCalledWith('tok_abc'));
    expect(await screen.findByText("You're in")).toBeInTheDocument();
  });

  it('reads the invitation with no session required', async () => {
    renderInvitation();
    await screen.findByText(/You were invited to Client X/);
    expect(getInvitationMock).toHaveBeenCalledWith('tok_abc');
  });

  it('shows the backend refusal when the invitation cannot be read', async () => {
    const { ApiError } = await import('@slideops/api-client');
    getInvitationMock.mockRejectedValueOnce(
      new ApiError(409, 'already_accepted', 'That invitation was already accepted.'),
    );
    renderInvitation();
    expect(await screen.findByText('That invitation was already accepted.')).toBeInTheDocument();
  });
});
