import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderInApp } from '../../test/render';
import { useAuthStore } from '../../store/auth';
import { useWorkspaceStore } from '../../store/workspace';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  } as unknown as Response;
}

const own = { owner_operator_id: 'op_1', owner_email: 'me@example.com', role: 'owner' as const, active: true };
const shared = {
  owner_operator_id: 'op_2',
  owner_email: 'them@example.com',
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
  it('renders nothing with only the Operator\'s own workspace', () => {
    useWorkspaceStore.setState({ workspaces: [own], loaded: true });
    const { container } = renderInApp(<WorkspaceSwitcher />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the active workspace and offers the others', async () => {
    useWorkspaceStore.setState({ workspaces: [own, shared], loaded: true });
    renderInApp(<WorkspaceSwitcher />);

    expect(screen.getByText('Your workspace')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Your workspace/i }));
    expect(screen.getByText('them@example.com')).toBeInTheDocument();
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

    renderInApp(<WorkspaceSwitcher />);
    await userEvent.click(screen.getByRole('button', { name: /Your workspace/i }));
    await userEvent.click(screen.getByText('them@example.com'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const switchCall = fetchMock.mock.calls[0]?.[1];
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/workspaces/switch');
    expect(JSON.parse(String(switchCall?.body))).toEqual({ owner_operator_id: 'op_2' });
  });
});
