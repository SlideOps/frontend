import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { renderInApp } from '../../test/render';
import { useAuthStore } from '../../store/auth';
import { useWorkspaceStore } from '../../store/workspace';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';

function renderSwitcher() {
  return renderInApp(
    <MemoryRouter>
      <WorkspaceSwitcher />
    </MemoryRouter>,
  );
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  } as unknown as Response;
}

const own = { id: 'ws_1', name: 'Personal', is_personal: true, role: 'owner' as const, active: true };
const shared = {
  id: 'ws_2',
  name: 'Client X',
  is_personal: false,
  role: 'member' as const,
  active: false,
};

beforeEach(() => {
  useWorkspaceStore.setState({ workspaces: [], loaded: false });
  useAuthStore.setState({
    status: 'authenticated',
    operator: {
      id: 'op_1',
      email: 'me@example.com',
      role: 'operator',
      mfa_enabled: false,
      has_password: true,
      created_at: 'now',
    },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('WorkspaceSwitcher', () => {
  it('renders nothing before any workspace has loaded', () => {
    const { container } = renderSwitcher();
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the active workspace name even with only a Personal one', async () => {
    useWorkspaceStore.setState({ workspaces: [own], loaded: true });
    renderSwitcher();

    expect(screen.getByText('Personal')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Personal/i }));
    expect(screen.getByText('Create workspace')).toBeInTheDocument();
    expect(screen.getByText('Manage workspaces')).toBeInTheDocument();
  });

  it('offers every workspace and their role once opened', async () => {
    useWorkspaceStore.setState({ workspaces: [own, shared], loaded: true });
    renderSwitcher();

    await userEvent.click(screen.getByRole('button', { name: /Personal/i }));
    expect(screen.getByText('Client X')).toBeInTheDocument();
    expect(screen.getByText('Member')).toBeInTheDocument();
  });

  it('switches to another workspace on selection', async () => {
    useWorkspaceStore.setState({ workspaces: [own, shared], loaded: true });
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(204, undefined))
      .mockResolvedValueOnce(
        jsonResponse(200, { workspaces: [{ ...own, active: false }, { ...shared, active: true }] }),
      );

    renderSwitcher();
    await userEvent.click(screen.getByRole('button', { name: /Personal/i }));
    await userEvent.click(screen.getByText('Client X'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const switchCall = fetchMock.mock.calls[0]?.[1];
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/workspaces/switch');
    expect(JSON.parse(String(switchCall?.body))).toEqual({ workspace_id: 'ws_2' });
  });

  it('creates a workspace by name and switches into it', async () => {
    useWorkspaceStore.setState({ workspaces: [own], loaded: true });
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse(201, {
          workspace: { id: 'ws_3', name: 'Client Y', is_personal: false, role: 'owner', active: false },
        }),
      )
      .mockResolvedValueOnce(jsonResponse(204, undefined))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          workspaces: [{ ...own, active: false }, { id: 'ws_3', name: 'Client Y', is_personal: false, role: 'owner', active: true }],
        }),
      );

    renderSwitcher();
    await userEvent.click(screen.getByRole('button', { name: /Personal/i }));
    await userEvent.click(screen.getByText('Create workspace'));
    await userEvent.type(screen.getByLabelText('Workspace name'), 'Client Y');
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    const createCall = fetchMock.mock.calls[0]?.[1];
    expect(JSON.parse(String(createCall?.body))).toEqual({ name: 'Client Y' });
    const switchCall = fetchMock.mock.calls[1]?.[1];
    expect(JSON.parse(String(switchCall?.body))).toEqual({ workspace_id: 'ws_3' });
  });
});
