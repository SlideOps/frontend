import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetShownToasts } from './shownToasts';
import { Toaster } from './Toaster';
import type { AppNotification } from './store';
import { useNotificationsStore } from './store';

/*
 * A notification the durable backend already has marked read, an Operator
 * revisiting the app rather than seeing something for the first time, must
 * never toast: this is exactly the production bug where an old, already read
 * "someone joined your Workspace" notification popped up fresh on every
 * single login, on every browser, because the toast decision only asked
 * whether this page load had personally seen it before, never whether the
 * Operator had.
 *
 * Read alone was not enough to close it. A notification that arrives on the
 * live event stream has read state that never leaves memory, so a reload
 * brought it back unread and it toasted again, and again. What stops that is
 * this browser's own record of having already shown the thing, kept apart from
 * read so that recording a toast never quietly clears the unread badge.
 */

function show() {
  return render(
    <MemoryRouter>
      <Toaster />
    </MemoryRouter>,
  );
}

/** A live-stream Operation result: read state for one of these lives in memory only. */
function streamed(over: Partial<AppNotification> = {}): AppNotification {
  return {
    id: 'op_1:4',
    operationId: 'op_1',
    kind: 'completion',
    tone: 'success',
    title: 'Operation completed and verified',
    body: 'The Operation finished.',
    at: '2026-09-01T00:00:00Z',
    read: false,
    ...over,
  };
}

beforeEach(() => {
  useNotificationsStore.setState({ items: [], unread: 0 });
  forgetShownToasts();
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Toaster', () => {
  it('never toasts a notification synced in already read', async () => {
    show();
    act(() => {
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
    });

    await waitFor(() => {
      expect(screen.queryByText('sarvachain@gmail.com joined SlideOps')).toBeNull();
    });
  });

  it('toasts a genuinely unread notification', async () => {
    show();
    act(() => {
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
    });

    expect(await screen.findByText('A brand new invite was accepted')).toBeInTheDocument();
  });

  it('does not toast a notification it has already shown, after a remount', async () => {
    const first = show();
    const item = streamed();
    act(() => {
      useNotificationsStore.getState().push(item);
    });
    expect(await screen.findByText(item.title)).toBeInTheDocument();
    first.unmount();

    show();

    await waitFor(() => {
      expect(screen.queryByText(item.title)).toBeNull();
    });
  });

  it('does not toast a notification it has already shown, on a fresh load', async () => {
    // A reload rebuilds the store from the stream, so the notification is
    // unread again: the only thing that can still recognise it is the record
    // the previous load left behind in storage.
    const item = streamed();
    window.localStorage.setItem('slideops.notifications.shown', JSON.stringify([item.id]));
    vi.resetModules();
    const [{ Toaster: Reloaded }, store] = await Promise.all([
      import('./Toaster'),
      import('./store'),
    ]);

    render(
      <MemoryRouter>
        <Reloaded />
      </MemoryRouter>,
    );
    act(() => {
      store.useNotificationsStore.getState().push(item);
    });

    expect(screen.queryByText(item.title)).toBeNull();
  });

  it('counts a toast that eases away on its own as already shown', async () => {
    vi.useFakeTimers();
    try {
      const item = streamed();
      const first = show();
      act(() => {
        useNotificationsStore.getState().push(item);
      });
      expect(screen.getByText(item.title)).toBeInTheDocument();

      // Nobody dismissed it; it simply timed out.
      act(() => {
        vi.advanceTimersByTime(10_000);
      });
      expect(screen.queryByText(item.title)).toBeNull();
      first.unmount();

      show();

      expect(screen.queryByText(item.title)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('leaves the unread count alone when it records a toast as shown', async () => {
    show();
    const item = streamed();
    act(() => {
      useNotificationsStore.getState().push(item);
    });
    expect(await screen.findByText(item.title)).toBeInTheDocument();

    expect(useNotificationsStore.getState().unread).toBe(1);
    expect(useNotificationsStore.getState().items.map((entry) => entry.read)).toEqual([false]);
  });

  it('still toasts once when local storage refuses to store anything', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage is blocked in this window');
    });
    const item = streamed();

    const first = show();
    act(() => {
      useNotificationsStore.getState().push(item);
    });
    expect(await screen.findByText(item.title)).toBeInTheDocument();
    first.unmount();

    // Nothing could be stored, but the session still knows it has shown this.
    show();

    await waitFor(() => {
      expect(screen.queryByText(item.title)).toBeNull();
    });
  });
});

/*
 * A toast that arrives while another is on screen must not stop the first one
 * leaving.
 *
 * The dismiss countdowns used to be cleaned up whenever the notification list
 * changed, so a new notification cancelled the countdown of every toast already
 * showing. On a busy Workspace they stacked up and stayed there.
 */
describe('a toast arriving behind another', () => {
  it('lets the first toast leave on its own even when a second arrives behind it', async () => {
    vi.useFakeTimers();
    try {
      show();

      act(() => {
        useNotificationsStore.getState().push(streamed({ id: 'op_1:1', title: 'The first thing' }));
      });
      expect(screen.getByText('The first thing')).toBeInTheDocument();

      // A second arrives partway through the first one's countdown.
      act(() => {
        vi.advanceTimersByTime(1000);
        useNotificationsStore.getState().push(streamed({ id: 'op_2:1', title: 'The second thing' }));
      });
      expect(screen.getByText('The second thing')).toBeInTheDocument();

      // Well past the first one's countdown, had it survived the new arrival.
      act(() => {
        vi.advanceTimersByTime(30000);
      });
      expect(screen.queryByText('The first thing')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
