import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type PendingInvitation } from '@slideops/api-client';
import { renderInApp } from '../../test/render';
import { useWorkspaceStore } from '../../store/workspace';

/*
 * The real bug this locks in: an invited Operator's own dashboard -- the
 * screen they actually land on after signing in, at /app -- never showed a
 * pending invitation at all, regardless of who sent it. Only a separate
 * Workspaces page and a small switcher badge did. An Operator who never
 * thought to open either page had no way to discover they had been invited
 * to anything short of finding the email, which is exactly what "B invites A,
 * A never sees it" looked like from the invitee's side.
 */

const pendingInvitation: PendingInvitation = {
  token: 'tok_1',
  workspace_name: 'Agency Shared',
  role: 'member',
  invited_at: '2026-07-23T00:00:00Z',
};

let invitations: PendingInvitation[] = [];
const acceptInvitationMock = vi.fn(async (_token: string) => undefined);
const declineInvitationMock = vi.fn(async (_token: string) => undefined);

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  listProjects: async () => [],
  listNodes: async () => [],
  listOperations: async () => [],
  listCapabilities: async () => [],
  listMyInvitations: async () => invitations,
  acceptInvitation: (...args: [string]) => acceptInvitationMock(...args),
  declineInvitation: (...args: [string]) => declineInvitationMock(...args),
}));

const { Workspace } = await import('./Workspace');

function show() {
  return renderInApp(
    <MemoryRouter>
      <Workspace />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useWorkspaceStore.setState({
    workspaces: [{ id: 'ws_1', name: 'Personal', is_personal: true, role: 'owner', active: true }],
    loaded: true,
  });
  invitations = [];
  acceptInvitationMock.mockClear();
  declineInvitationMock.mockClear();
});

describe('Workspace dashboard', () => {
  it('shows an invitation waiting for this account, whoever sent it', async () => {
    invitations = [pendingInvitation];
    show();

    await screen.findByText('Waiting for you');
    expect(screen.getByText('Agency Shared')).toBeInTheDocument();
  });

  it('shows nothing extra when there is no pending invitation', async () => {
    show();

    await screen.findByRole('heading', { name: 'Connect your first Node' });
    expect(screen.queryByText('Waiting for you')).not.toBeInTheDocument();
  });

  it('accepts an invitation right from the dashboard', async () => {
    invitations = [pendingInvitation];
    show();

    await screen.findByText('Waiting for you');
    await userEvent.click(screen.getByRole('button', { name: 'Accept' }));

    await waitFor(() => expect(acceptInvitationMock).toHaveBeenCalledWith('tok_1'));
  });

  it('declines an invitation right from the dashboard', async () => {
    invitations = [pendingInvitation];
    show();

    await screen.findByText('Waiting for you');
    await userEvent.click(screen.getByRole('button', { name: 'Decline' }));

    await waitFor(() => expect(declineInvitationMock).toHaveBeenCalledWith('tok_1'));
    expect(acceptInvitationMock).not.toHaveBeenCalled();
  });
});
