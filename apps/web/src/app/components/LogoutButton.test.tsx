import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../../store/auth';
import { useWorkspaceStore } from '../../store/workspace';
import { useNotificationsStore } from '../notifications/store';
import { LogoutButton } from './LogoutButton';

/*
 * A second Operator signing in on the same browser tab after the first signs
 * out must never see the first account's leftover notification bell content
 * (an invitation's own workspace name among what a notification can carry).
 * Signing out only reset the workspace store, never the notifications store,
 * which a client-side navigation to /login does not clear on its own since
 * there is no full page reload to do it for free.
 */

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  logout: vi.fn().mockResolvedValue(undefined),
}));

function show() {
  return render(
    <MemoryRouter>
      <LogoutButton />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useNotificationsStore.setState({ items: [], unread: 0 });
  useNotificationsStore.getState().push({
    id: 'inbox:n1',
    remoteId: 'n1',
    kind: 'inbox',
    tone: 'info',
    title: 'previous-operator@example.com joined SlideOps',
    body: '',
    at: '2026-08-28T00:17:12Z',
    read: false,
  });
  useAuthStore.setState({
    status: 'authenticated',
    operator: { id: 'op-1', email: 'previous-operator@example.com', role: 'operator' } as never,
  });
});

describe('LogoutButton', () => {
  it('clears the notification bell so the next Operator on this tab never sees a stale one', async () => {
    expect(useNotificationsStore.getState().items).toHaveLength(1);

    show();
    await userEvent.click(screen.getByRole('button', { name: /sign out/i }));

    await waitFor(() => {
      expect(useNotificationsStore.getState().items).toHaveLength(0);
    });
    expect(useNotificationsStore.getState().unread).toBe(0);
  });

  it('also resets the workspace store on sign out', async () => {
    useWorkspaceStore.setState({
      workspaces: [{ id: 'ws-1', name: 'Personal', role: 'owner' } as never],
      loaded: true,
    });

    show();
    await userEvent.click(screen.getByRole('button', { name: /sign out/i }));

    await waitFor(() => {
      expect(useWorkspaceStore.getState().workspaces).toHaveLength(0);
    });
  });
});
