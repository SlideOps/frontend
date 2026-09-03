import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { Toaster } from './Toaster';
import { useNotificationsStore } from './store';

/*
 * A notification the durable backend already has marked read, an Operator
 * revisiting the app rather than seeing something for the first time, must
 * never toast: this is exactly the production bug where an old, already read
 * "someone joined your Workspace" notification popped up fresh on every
 * single login, on every browser, because the toast decision only asked
 * whether this page load had personally seen it before, never whether the
 * Operator had.
 */

function show() {
  return render(
    <MemoryRouter>
      <Toaster />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useNotificationsStore.setState({ items: [], unread: 0 });
});

describe('Toaster', () => {
  it('never toasts a notification synced in already read', async () => {
    show();
    useNotificationsStore.getState().push({
      id: 'inbox:n1',
      remoteId: 'n1',
      kind: 'inbox',
      tone: 'info',
      title: 'sarvachain@gmail.com joined SlideOps',
      body: '',
      at: '2026-08-28T00:17:12Z',
      read: true,
    });

    await waitFor(() => {
      expect(screen.queryByText('sarvachain@gmail.com joined SlideOps')).toBeNull();
    });
  });

  it('toasts a genuinely unread notification', async () => {
    show();
    useNotificationsStore.getState().push({
      id: 'inbox:n2',
      remoteId: 'n2',
      kind: 'inbox',
      tone: 'info',
      title: 'A brand new invite was accepted',
      body: '',
      at: '2026-09-01T00:00:00Z',
      read: false,
    });

    expect(await screen.findByText('A brand new invite was accepted')).toBeInTheDocument();
  });
});
