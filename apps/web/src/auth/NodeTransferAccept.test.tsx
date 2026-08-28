import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NodeTransferPreview, Operator, Workspace } from '@slideops/api-client';
import { renderInApp } from '../test/render';
import { useAuthStore } from '../store/auth';
import { useWorkspaceStore } from '../store/workspace';

const preview: NodeTransferPreview = {
  node_name: 'client-vps',
  from_workspace_name: 'Agency Workspace',
  message: 'Here is your fully configured server.',
};

const getNodeTransferPreviewMock = vi.fn(async (_token: string) => preview);
const acceptNodeTransferMock = vi.fn(async (_token: string, _workspaceId?: string) => ({
  id: 'nt_1',
  node_id: 'node_1',
  to_email: 'me@example.com',
  status: 'accepted',
  message: '',
  created_at: '2026-08-28T00:00:00Z',
  decided_at: '2026-08-28T00:05:00Z',
}));
const declineNodeTransferMock = vi.fn(async (_token: string) => undefined);
const listWorkspacesMock = vi.fn(async () => [] as Workspace[]);

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getNodeTransferPreview: (...args: [string]) => getNodeTransferPreviewMock(...args),
  acceptNodeTransfer: (...args: [string, string | undefined]) => acceptNodeTransferMock(...args),
  declineNodeTransfer: (...args: [string]) => declineNodeTransferMock(...args),
  listWorkspaces: () => listWorkspacesMock(),
}));

const { NodeTransferAccept } = await import('./NodeTransferAccept');

function renderTransfer() {
  return renderInApp(
    <MemoryRouter initialEntries={['/node-transfers/tok_abc']}>
      <Routes>
        <Route path="/node-transfers/:token" element={<NodeTransferAccept />} />
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

const personal: Workspace = {
  id: 'ws_personal',
  name: 'Personal',
  is_personal: true,
  role: 'owner',
  active: true,
};

beforeEach(() => {
  getNodeTransferPreviewMock.mockClear();
  acceptNodeTransferMock.mockClear();
  declineNodeTransferMock.mockClear();
  listWorkspacesMock.mockClear();
  listWorkspacesMock.mockResolvedValue([personal]);
  useWorkspaceStore.setState({ workspaces: [], loaded: false });
  useAuthStore.setState({ status: 'anonymous', operator: null });
});

describe('NodeTransferAccept', () => {
  it('offers sign in and sign up when nobody is signed in', async () => {
    renderTransfer();
    expect(await screen.findByText(/client-vps/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign in to review/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create an account/i })).toBeInTheDocument();
  });

  it('sends an anonymous visitor to sign in and back to this transfer', async () => {
    renderTransfer();
    await userEvent.click(await screen.findByRole('button', { name: /Sign in to review/i }));
    expect(await screen.findByText('the sign in screen')).toBeInTheDocument();
  });

  it('shows the initiator message', async () => {
    useAuthStore.setState({ status: 'authenticated', operator });
    renderTransfer();
    expect(await screen.findByText(/Here is your fully configured server/)).toBeInTheDocument();
  });

  it('lets a signed in Operator accept into their Personal workspace with one click', async () => {
    useAuthStore.setState({ status: 'authenticated', operator });
    renderTransfer();

    const acceptButton = await screen.findByRole('button', { name: /Accept this node/i });
    await userEvent.click(acceptButton);

    await waitFor(() => expect(acceptNodeTransferMock).toHaveBeenCalledWith('tok_abc', undefined));
    expect(await screen.findByText("It's yours")).toBeInTheDocument();
  });

  it('offers no destination picker with only one owned workspace', async () => {
    useAuthStore.setState({ status: 'authenticated', operator });
    renderTransfer();
    await screen.findByRole('button', { name: /Accept this node/i });
    expect(screen.queryByLabelText('Receive it into')).not.toBeInTheDocument();
  });

  it('offers a destination picker with more than one owned workspace', async () => {
    const client: Workspace = {
      id: 'ws_client',
      name: 'Client Y',
      is_personal: false,
      role: 'owner',
      active: false,
    };
    listWorkspacesMock.mockResolvedValue([personal, client]);
    useAuthStore.setState({ status: 'authenticated', operator });
    renderTransfer();

    await screen.findByLabelText('Receive it into');
    expect(screen.getByText('Client Y')).toBeInTheDocument();
  });

  it('lets a signed in Operator decline', async () => {
    useAuthStore.setState({ status: 'authenticated', operator });
    renderTransfer();

    const declineButton = await screen.findByRole('button', { name: /^Decline$/i });
    await userEvent.click(declineButton);

    await waitFor(() => expect(declineNodeTransferMock).toHaveBeenCalledWith('tok_abc'));
    expect(await screen.findByText('Transfer declined')).toBeInTheDocument();
  });

  it('reads the transfer with no session required', async () => {
    renderTransfer();
    await screen.findByText(/client-vps/);
    expect(getNodeTransferPreviewMock).toHaveBeenCalledWith('tok_abc');
  });

  it('shows the backend refusal when the transfer cannot be read', async () => {
    const { ApiError } = await import('@slideops/api-client');
    getNodeTransferPreviewMock.mockRejectedValueOnce(
      new ApiError(409, 'already_decided', 'This transfer has already been decided.'),
    );
    renderTransfer();
    expect(await screen.findByText('This transfer has already been decided.')).toBeInTheDocument();
  });
});
