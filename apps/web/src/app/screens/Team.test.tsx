import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Member, Workspace } from '@slideops/api-client';
import { renderInApp } from '../../test/render';
import { useWorkspaceStore } from '../../store/workspace';

const ownerWorkspace: Workspace = {
  id: 'ws_1',
  name: 'Personal',
  is_personal: true,
  role: 'owner',
  active: true,
};

const viewerWorkspace: Workspace = {
  id: 'ws_9',
  name: 'Client X',
  is_personal: false,
  role: 'viewer',
  active: true,
};

const activeMember: Member = {
  id: 'wm_1',
  email: 'admin@example.com',
  role: 'admin',
  status: 'active',
  invited_at: '2026-07-01T00:00:00Z',
  accepted_at: '2026-07-02T00:00:00Z',
};

const pendingInvite: Member = {
  id: 'wm_2',
  email: 'pending@example.com',
  role: 'viewer',
  status: 'pending',
  invited_at: '2026-08-01T00:00:00Z',
};

let workspaces: Workspace[] = [ownerWorkspace];
let team: Member[] = [activeMember, pendingInvite];
const inviteTeamMemberMock = vi.fn(async (_email: string, _role: string) => activeMember);
const updateTeamMemberRoleMock = vi.fn(async (_id: string, _role: string) => activeMember);
const removeTeamMemberMock = vi.fn(async (_id: string) => undefined);

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  listWorkspaces: async () => workspaces,
  listTeam: async () => team,
  inviteTeamMember: (...args: [string, string]) => inviteTeamMemberMock(...args),
  updateTeamMemberRole: (...args: [string, string]) => updateTeamMemberRoleMock(...args),
  removeTeamMember: (...args: [string]) => removeTeamMemberMock(...args),
}));

const { Team } = await import('./Team');

function renderTeam() {
  return renderInApp(
    <MemoryRouter>
      <Team />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useWorkspaceStore.setState({ workspaces: [], loaded: false });
  workspaces = [ownerWorkspace];
  team = [activeMember, pendingInvite];
  inviteTeamMemberMock.mockClear();
  updateTeamMemberRoleMock.mockClear();
  removeTeamMemberMock.mockClear();
});

describe('Team', () => {
  it('lists active members and pending invitations with their status', async () => {
    renderTeam();
    expect(await screen.findByText('admin@example.com')).toBeInTheDocument();
    expect(screen.getByText('pending@example.com')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('an Owner can invite a teammate by email and role', async () => {
    renderTeam();
    const inviteButton = await screen.findByRole('button', { name: /Invite/i });
    await userEvent.click(inviteButton);

    const dialog = screen.getByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Email'), 'new@example.com');
    await userEvent.selectOptions(within(dialog).getByLabelText('Role'), 'admin');
    await userEvent.click(within(dialog).getByRole('button', { name: /Send invitation/i }));

    await waitFor(() => expect(inviteTeamMemberMock).toHaveBeenCalledWith('new@example.com', 'admin'));
  });

  it('an Owner can remove a member after confirming', async () => {
    renderTeam();
    await screen.findByText('admin@example.com');
    const removeButtons = await screen.findAllByRole('button', { name: 'Remove' });
    await userEvent.click(removeButtons[0]!);

    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));

    await waitFor(() => expect(removeTeamMemberMock).toHaveBeenCalledWith('wm_1'));
  });

  it('a Viewer sees no manage controls', async () => {
    workspaces = [viewerWorkspace];
    renderTeam();

    await screen.findByText('admin@example.com');
    expect(screen.queryByRole('button', { name: /Invite/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
    expect(
      screen.getByText(/Only an Owner or an Admin can invite, change a role, or remove someone\./),
    ).toBeInTheDocument();
  });

  it('says so plainly when the workspace has nobody invited yet', async () => {
    team = [];
    renderTeam();
    expect(await screen.findByText(/It's just you here so far/)).toBeInTheDocument();
  });
});
