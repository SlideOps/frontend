import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderInApp } from '../../test/render';
import { NotificationsBell } from './NotificationsBell';
import type { AppNotification } from './store';
import { useNotificationsStore } from './store';

/*
 * The bell hangs at the right of the header, so its panel is the one overlay in
 * the app with no room to its right. It used to demand a fixed 288px whatever
 * the window was, open leftward from the bell, and hold every row on a single
 * unbreakable line, which on a phone put the right of the panel, the browser
 * notification control included, off the screen entirely.
 *
 * jsdom has no layout engine, so what it can check is the rules the panel is
 * laid out by: that it hangs from the bell's right edge, that it is capped
 * against the window rather than assuming there is room, that its content takes
 * the width it is given, and that text wraps instead of stretching the row. What
 * a browser then does with those rules is the same in either theme.
 */

const api = vi.hoisted(() => ({
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}));

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  ...api,
}));

function inboxNotification(over: Partial<AppNotification> = {}): AppNotification {
  return {
    id: 'inbox:n1',
    remoteId: 'n1',
    kind: 'inbox',
    tone: 'info',
    title: 'You were invited to a Workspace',
    body: 'Accept the invitation to start operating.',
    at: '2026-09-01T00:00:00Z',
    read: false,
    href: '/app/workspaces',
    ...over,
  };
}

function showBell(items: AppNotification[]) {
  useNotificationsStore.setState({
    items,
    unread: items.filter((item) => !item.read).length,
    // jsdom has no Notification constructor, and the opt-in row hides itself
    // when the browser has none, so the permission is set as a browser that
    // has not been asked yet.
    pushPermission: 'default',
    pushEnabled: false,
  });
  return renderInApp(
    <MemoryRouter>
      <NotificationsBell />
    </MemoryRouter>,
  );
}

/** Open the bell and hand back its panel. */
async function openPanel(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /Notifications/ }));
  return screen.getByRole('dialog', { name: 'Notifications' });
}

beforeEach(() => {
  api.markNotificationRead.mockReset().mockResolvedValue(undefined);
  api.markAllNotificationsRead.mockReset().mockResolvedValue(undefined);
  useNotificationsStore.setState({ items: [], unread: 0 });
});

describe('NotificationsBell', () => {
  it('hangs the panel from the bell right edge and caps it against the window', async () => {
    const user = userEvent.setup();
    showBell([inboxNotification()]);

    const panel = await openPanel(user);

    expect(panel.className).toContain('right-0');
    expect(panel.className).not.toContain('left-0');
    expect(panel.className).toMatch(/max-w-\[min\(/);
  });

  it('lets the panel content take the width it is given rather than a fixed one', async () => {
    const user = userEvent.setup();
    showBell([inboxNotification()]);

    const panel = await openPanel(user);
    const content = panel.firstElementChild as HTMLElement;

    expect(content.className).toContain('w-full');
    expect(content.className).toContain('min-w-0');
    expect(content.className).not.toContain('w-72');
  });

  it('caps the panel height against the window so a short screen scrolls the list', async () => {
    const user = userEvent.setup();
    showBell([inboxNotification()]);

    const panel = await openPanel(user);
    const content = panel.firstElementChild as HTMLElement;

    expect(content.className).toMatch(/max-h-\[calc\(100dvh/);
    expect(screen.getByRole('list').className).toContain('max-h-80');
    expect(screen.getByRole('list').className).toContain('overflow-y-auto');
  });

  it('wraps a long notification title instead of widening the panel', async () => {
    const user = userEvent.setup();
    const title =
      'Deployment of orders-api-with-a-very-long-service-name-nobody-would-shorten completed';
    showBell([inboxNotification({ title, body: 'x'.repeat(400) })]);

    await openPanel(user);
    const heading = screen.getByText(title);
    const body = screen.getByText('x'.repeat(400));

    expect(heading.className).toContain('break-words');
    expect(heading.className).not.toContain('truncate');
    expect(body.className).toContain('break-words');
    expect(body.className).not.toContain('truncate');
    // The row itself must be allowed to shrink, or a long line stretches it.
    expect((heading.parentElement as HTMLElement).className).toContain('min-w-0');
  });

  it('keeps the browser notification button inside its container at any width', async () => {
    const user = userEvent.setup();
    showBell([inboxNotification()]);

    const panel = await openPanel(user);
    const button = within(panel).getByRole('button', { name: 'Turn on' });
    const row = button.parentElement as HTMLElement;

    expect(row.className).toContain('flex-wrap');
    expect(button.className).toContain('shrink-0');
    expect(button.className).toContain('max-w-full');
  });

  it('persists read state to the server when a durable inbox notification is opened', async () => {
    const user = userEvent.setup();
    showBell([inboxNotification()]);

    const panel = await openPanel(user);
    await user.click(within(panel).getByText('You were invited to a Workspace'));

    expect(api.markNotificationRead).toHaveBeenCalledWith('n1');
    expect(useNotificationsStore.getState().unread).toBe(0);
  });

  it('persists read state to the server when the Operator marks everything read', async () => {
    const user = userEvent.setup();
    showBell([inboxNotification()]);

    const panel = await openPanel(user);
    await user.click(within(panel).getByRole('button', { name: /Mark all read/ }));

    expect(api.markAllNotificationsRead).toHaveBeenCalledTimes(1);
    expect(useNotificationsStore.getState().unread).toBe(0);
  });

  it('closes the panel on escape and on a click outside it', async () => {
    const user = userEvent.setup();
    showBell([inboxNotification()]);

    await openPanel(user);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Notifications' })).toBeNull();

    await openPanel(user);
    await user.click(document.body);
    expect(screen.queryByRole('dialog', { name: 'Notifications' })).toBeNull();
  });
});
