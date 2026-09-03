import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  type IncomingNodeTransfer,
  type PendingInvitation,
  type Workspace,
} from '@slideops/api-client';
import { renderInApp } from '../../test/render';
import { useWorkspaceStore } from '../../store/workspace';

const personal: Workspace = {
  id: 'ws_1',
  name: 'Personal',
  is_personal: true,
  role: 'owner',
  active: true,
};

const clientX: Workspace = {
  id: 'ws_2',
  name: 'Client X',
  is_personal: false,
  role: 'owner',
  active: false,
};

const memberWorkspace: Workspace = {
  id: 'ws_3',
  name: 'Agency Shared',
  is_personal: false,
  role: 'member',
  active: false,
};

const pendingInvitation: PendingInvitation = {
  token: 'tok_1',
  workspace_name: 'Agency Shared',
  role: 'member',
  invited_at: '2026-07-23T00:00:00Z',
};

const incomingTransfer: IncomingNodeTransfer = {
  token: 'nt_tok_1',
  node_name: 'client-vps',
  from_workspace_name: 'Agency Shared',
  message: '',
  created_at: '2026-08-28T00:00:00Z',
};

let workspaces: Workspace[] = [personal];
let invitations: PendingInvitation[] = [];
let nodeTransfers: IncomingNodeTransfer[] = [];
const createWorkspaceMock = vi.fn(async (_name: string) => clientX);
const renameWorkspaceMock = vi.fn(async (_id: string, name: string) => ({ ...clientX, name }));
const deleteWorkspaceMock = vi.fn(async (_id: string) => undefined);
const switchWorkspaceMock = vi.fn(async (_id: string) => undefined);
const acceptInvitationMock = vi.fn(async (_token: string) => undefined);
const declineInvitationMock = vi.fn(async (_token: string) => undefined);
const acceptNodeTransferMock = vi.fn(async (_token: string) => undefined);
const declineNodeTransferMock = vi.fn(async (_token: string) => undefined);

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  listWorkspaces: async () => workspaces,
  createWorkspace: (...args: [string]) => createWorkspaceMock(...args),
  renameWorkspace: (...args: [string, string]) => renameWorkspaceMock(...args),
  deleteWorkspace: (...args: [string]) => deleteWorkspaceMock(...args),
  switchWorkspace: (...args: [string]) => switchWorkspaceMock(...args),
  listMyInvitations: async () => invitations,
  acceptInvitation: (...args: [string]) => acceptInvitationMock(...args),
  declineInvitation: (...args: [string]) => declineInvitationMock(...args),
  listIncomingNodeTransfers: async () => nodeTransfers,
  acceptNodeTransfer: (...args: [string]) => acceptNodeTransferMock(...args),
  declineNodeTransfer: (...args: [string]) => declineNodeTransferMock(...args),
}));

const { WorkspaceHub } = await import('./WorkspaceHub');

function renderHub() {
  return renderInApp(
    <MemoryRouter>
      <WorkspaceHub />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useWorkspaceStore.setState({ workspaces: [], loaded: false });
  workspaces = [personal];
  invitations = [];
  nodeTransfers = [];
  createWorkspaceMock.mockClear();
  renameWorkspaceMock.mockClear();
  deleteWorkspaceMock.mockClear();
  switchWorkspaceMock.mockClear();
  acceptInvitationMock.mockClear();
  declineInvitationMock.mockClear();
  acceptNodeTransferMock.mockClear();
  declineNodeTransferMock.mockClear();
});

describe('WorkspaceHub', () => {
  it('lists every workspace the Operator can act in', async () => {
    workspaces = [personal, clientX];
    renderHub();

    await screen.findByRole('heading', { name: 'Workspaces' });
    expect(screen.getAllByText('Personal').length).toBeGreaterThan(0);
    expect(screen.getByText('Client X')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('creates a workspace by name', async () => {
    renderHub();
    await screen.findByRole('heading', { name: 'Workspaces' });

    await userEvent.click(screen.getByRole('button', { name: /Create workspace/i }));
    await userEvent.type(screen.getByLabelText('Workspace name'), 'Client X');
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(createWorkspaceMock).toHaveBeenCalledWith('Client X'));
  });

  it('switches into a non active workspace', async () => {
    workspaces = [personal, clientX];
    renderHub();

    await userEvent.click(await screen.findByRole('button', { name: 'Switch to this' }));

    await waitFor(() => expect(switchWorkspaceMock).toHaveBeenCalledWith('ws_2'));
  });

  it('renames a workspace it owns', async () => {
    workspaces = [personal, clientX];
    renderHub();
    await screen.findByText('Client X');

    const renameButtons = screen.getAllByRole('button', { name: /Rename/i });
    await userEvent.click(renameButtons[1]!);
    const input = screen.getByLabelText('Workspace name');
    await userEvent.clear(input);
    await userEvent.type(input, 'Client Y');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(renameWorkspaceMock).toHaveBeenCalledWith('ws_2', 'Client Y'));
  });

  it('deletes a non personal workspace it owns after confirming', async () => {
    workspaces = [personal, clientX];
    renderHub();
    await screen.findByText('Client X');

    const deleteButtons = screen.getAllByRole('button', { name: /Delete/i });
    await userEvent.click(deleteButtons[0]!);
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(deleteWorkspaceMock).toHaveBeenCalledWith('ws_2'));
  });

  it('never offers rename or delete for a workspace held only as a member', async () => {
    workspaces = [personal, memberWorkspace];
    renderHub();
    await screen.findByText('Agency Shared');

    // Exactly one Rename and no Delete: both belong only to the owned Personal
    // workspace, never to the one held as a Member.
    expect(screen.getAllByRole('button', { name: /Rename/i })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /Delete/i })).not.toBeInTheDocument();
  });

  it('never offers deleting the Personal workspace', async () => {
    renderHub();
    await screen.findByRole('heading', { name: 'Workspaces' });

    expect(screen.queryByRole('button', { name: /Delete/i })).not.toBeInTheDocument();
  });

  it('shows the backend refusal when delete is refused', async () => {
    workspaces = [personal, clientX];
    deleteWorkspaceMock.mockRejectedValueOnce(
      new ApiError(
        409,
        'workspace_not_empty',
        'this workspace still has servers or projects in it',
      ),
    );
    renderHub();
    await screen.findByText('Client X');

    const deleteButtons = screen.getAllByRole('button', { name: /Delete/i });
    await userEvent.click(deleteButtons[0]!);
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    expect(
      await screen.findByText('this workspace still has servers or projects in it'),
    ).toBeInTheDocument();
  });

  // This is the exact gap an invited Operator hit in production: nothing
  // anywhere told them they had been invited. The hub is the fix.
  it('shows a pending invitation and accepts it', async () => {
    invitations = [pendingInvitation];
    renderHub();

    await screen.findByText('Agency Shared');
    expect(screen.getByText('Invited as Member')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Accept/i }));

    await waitFor(() => expect(acceptInvitationMock).toHaveBeenCalledWith('tok_1'));
  });

  it('declines a pending invitation without accepting it', async () => {
    invitations = [pendingInvitation];
    renderHub();

    await screen.findByText('Agency Shared');
    await userEvent.click(screen.getByRole('button', { name: /Decline/i }));

    await waitFor(() => expect(declineInvitationMock).toHaveBeenCalledWith('tok_1'));
    expect(acceptInvitationMock).not.toHaveBeenCalled();
  });

  it('shows a node transfer offered to it and accepts it', async () => {
    nodeTransfers = [incomingTransfer];
    renderHub();

    await screen.findByText('client-vps');
    expect(screen.getByText('Offered by Agency Shared')).toBeInTheDocument();

    const section = screen.getByText('Nodes offered to you').closest('div') as HTMLElement;
    await userEvent.click(within(section).getByRole('button', { name: /Accept/i }));

    await waitFor(() => expect(acceptNodeTransferMock).toHaveBeenCalledWith('nt_tok_1'));
  });

  it('declines a node transfer without accepting it', async () => {
    nodeTransfers = [incomingTransfer];
    renderHub();

    await screen.findByText('client-vps');
    const section = screen.getByText('Nodes offered to you').closest('div') as HTMLElement;
    await userEvent.click(within(section).getByRole('button', { name: /Decline/i }));

    await waitFor(() => expect(declineNodeTransferMock).toHaveBeenCalledWith('nt_tok_1'));
    expect(acceptNodeTransferMock).not.toHaveBeenCalled();
  });

  it('separates workspaces you own from ones shared with you', async () => {
    workspaces = [personal, clientX, memberWorkspace];
    renderHub();

    const ownedHeading = await screen.findByText('Your workspaces');
    const sharedHeading = screen.getByText('Shared with you');
    expect(ownedHeading).toBeInTheDocument();
    expect(sharedHeading).toBeInTheDocument();

    // "Agency Shared" (held as a member) must appear after the "Shared with
    // you" heading, not mixed in among the owned workspaces.
    const ownedPosition = ownedHeading.compareDocumentPosition(screen.getByText('Client X'));
    const sharedPosition = sharedHeading.compareDocumentPosition(screen.getByText('Agency Shared'));
    expect(ownedPosition & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(sharedPosition & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows no section headings when every workspace is owned', async () => {
    workspaces = [personal, clientX];
    renderHub();

    await screen.findByText('Client X');
    expect(screen.queryByText('Your workspaces')).not.toBeInTheDocument();
    expect(screen.queryByText('Shared with you')).not.toBeInTheDocument();
  });
});
