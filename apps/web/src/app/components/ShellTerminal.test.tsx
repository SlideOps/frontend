import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderInApp } from '../../test/render';
import { ShellTerminal } from './ShellTerminal';

// xterm draws with canvas and measures real layout, neither of which jsdom has.
// It is stubbed because what is under test is when a session is opened and
// closed, not how a terminal renders: that is xterm's own business and it is not
// this repository's to re-test.
vi.mock('@xterm/xterm', () => ({
  Terminal: class {
    cols = 100;
    rows = 30;
    options: Record<string, unknown> = {};
    loadAddon() {}
    open() {}
    write() {}
    focus() {}
    dispose() {}
    onData() {}
    onResize() {}
  },
}));

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: class {
    fit() {}
  },
}));

vi.mock('@xterm/xterm/css/xterm.css', () => ({}));

/*
 * The terminal component.
 *
 * The behaviour worth pinning is when it connects and when it does not, because
 * a shell is a session on somebody's server and every one of them is audited.
 * Connecting on page load would open a session because a page was looked at.
 */

// A websocket the test drives, standing in for the browser's.
class FakeSocket {
  static last: FakeSocket | null = null;
  static opened: string[] = [];

  static readonly OPEN = 1;
  readyState = 0;
  binaryType = '';
  sent: unknown[] = [];
  private listeners: Record<string, Array<(event: unknown) => void>> = {};

  constructor(public url: string) {
    FakeSocket.last = this;
    FakeSocket.opened.push(url);
  }

  addEventListener(type: string, handler: (event: unknown) => void) {
    (this.listeners[type] ??= []).push(handler);
  }

  send(data: unknown) {
    this.sent.push(data);
  }

  close() {
    this.readyState = 3;
    this.emit('close', {});
  }

  emit(type: string, event: unknown) {
    for (const handler of this.listeners[type] ?? []) {
      handler(event);
    }
  }

  openIt() {
    this.readyState = FakeSocket.OPEN;
    this.emit('open', {});
  }
}

beforeEach(() => {
  FakeSocket.last = null;
  FakeSocket.opened = [];
  vi.stubGlobal('WebSocket', FakeSocket as unknown as typeof WebSocket);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function render(over: Partial<Parameters<typeof ShellTerminal>[0]> = {}) {
  return renderInApp(
    <ShellTerminal
      urlFor={(cols, rows) => `ws://test/shell?cols=${cols}&rows=${rows}`}
      scopeLabel="Inside this Service"
      scopeDetail="Only this application is reachable."
      {...over}
    />,
  );
}

describe('ShellTerminal', () => {
  // A shell that connected on load would open a session on the Operator's server
  // because somebody looked at a page, and it would be in the audit trail.
  it('does not connect until the Operator asks for a shell', () => {
    render();
    expect(FakeSocket.opened).toHaveLength(0);
    expect(screen.getByRole('button', { name: /open a shell/i })).toBeInTheDocument();
  });

  it('says what the shell will attach to before it is opened', () => {
    render();
    expect(screen.getByText('Inside this Service')).toBeInTheDocument();
    expect(screen.getByText(/Only this application is reachable/i)).toBeInTheDocument();
  });

  it('connects on request, carrying the terminal size so the remote starts right', async () => {
    render();
    await userEvent.click(screen.getByRole('button', { name: /open a shell/i }));

    await waitFor(() => expect(FakeSocket.opened).toHaveLength(1));
    expect(FakeSocket.opened[0]).toMatch(/^ws:\/\/test\/shell\?cols=\d+&rows=\d+$/);
    expect(FakeSocket.last?.binaryType).toBe('arraybuffer');
  });

  // There is nothing to attach to, so the control is refused with the reason
  // rather than opening a socket that will be closed straight away.
  it('refuses to open when there is nothing to attach to, and says why', async () => {
    render({
      unavailableReason: 'This Service is stopped, so there is nothing to open a shell in.',
    });

    const button = screen.getByRole('button', { name: /open a shell/i });
    expect(button).toBeDisabled();
    expect(screen.getByText(/This Service is stopped/i)).toBeInTheDocument();

    await userEvent.click(button);
    expect(FakeSocket.opened).toHaveLength(0);
  });

  it('offers to close a live shell, and closes the connection', async () => {
    render();
    await userEvent.click(screen.getByRole('button', { name: /open a shell/i }));
    await waitFor(() => expect(FakeSocket.last).not.toBeNull());
    FakeSocket.last?.openIt();

    const close = await screen.findByRole('button', { name: /close/i });
    await userEvent.click(close);
    expect(FakeSocket.last?.readyState).toBe(3);
  });

  /*
   * Closing has to put the terminal away as well as end the session.
   *
   * The box was keyed on the idle status alone, so closing disposed the terminal
   * and left twenty four rems of empty bordered nothing sitting on the page.
   * Close looked like it had not worked, because the only thing that visibly
   * changed was a button label.
   */
  it('puts the terminal away when the shell is closed', async () => {
    const { container } = render();
    const box = () => container.querySelector('[style*="24rem"]');

    expect(box()?.className).toContain('hidden');

    await userEvent.click(screen.getByRole('button', { name: /open a shell/i }));
    await waitFor(() => expect(FakeSocket.last).not.toBeNull());
    FakeSocket.last?.openIt();
    await waitFor(() => expect(box()?.className).toContain('block'));

    await userEvent.click(await screen.findByRole('button', { name: /close/i }));
    await waitFor(() => expect(box()?.className).toContain('hidden'));
  });

  // Closing must not be a one way door: the same box has to come back.
  it('shows the terminal again when it is reopened', async () => {
    const { container } = render();
    const box = () => container.querySelector('[style*="24rem"]');

    await userEvent.click(screen.getByRole('button', { name: /open a shell/i }));
    await waitFor(() => expect(FakeSocket.last).not.toBeNull());
    FakeSocket.last?.openIt();
    await userEvent.click(await screen.findByRole('button', { name: /close/i }));
    await waitFor(() => expect(box()?.className).toContain('hidden'));

    await userEvent.click(await screen.findByRole('button', { name: /open again/i }));
    await waitFor(() => expect(box()?.className).toContain('block'));
  });

  /*
   * Filling the window, for reading a long log or running something full screen.
   *
   * It is not the browser's own fullscreen: that hides the tab strip and the
   * address bar, which is disorienting for something you are working in rather
   * than watching. Filling the window keeps the browser where it is and still
   * gives the terminal every pixel of the page.
   */
  it('offers to fill the window only once there is a session to fill it with', async () => {
    render();
    expect(screen.queryByRole('button', { name: /fill the window/i })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /open a shell/i }));
    await waitFor(() => expect(FakeSocket.last).not.toBeNull());
    FakeSocket.last?.openIt();

    expect(await screen.findByRole('button', { name: /fill the window/i })).toBeInTheDocument();
  });

  it('expands and comes back, and says which state it is in', async () => {
    render();
    await userEvent.click(screen.getByRole('button', { name: /open a shell/i }));
    await waitFor(() => expect(FakeSocket.last).not.toBeNull());
    FakeSocket.last?.openIt();

    const expand = await screen.findByRole('button', { name: /fill the window/i });
    expect(expand).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(expand);
    const shrink = await screen.findByRole('button', { name: /leave full screen/i });
    expect(shrink).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(shrink);
    expect(await screen.findByRole('button', { name: /fill the window/i })).toBeInTheDocument();
  });

  // A control you can enter and cannot leave by reflex is a trap.
  it('leaves the expanded view on Escape', async () => {
    render();
    await userEvent.click(screen.getByRole('button', { name: /open a shell/i }));
    await waitFor(() => expect(FakeSocket.last).not.toBeNull());
    FakeSocket.last?.openIt();

    await userEvent.click(await screen.findByRole('button', { name: /fill the window/i }));
    await screen.findByRole('button', { name: /leave full screen/i });

    await userEvent.keyboard('{Escape}');
    expect(await screen.findByRole('button', { name: /fill the window/i })).toBeInTheDocument();
  });

  /*
   * A terminal on one monitor while the thing you are following is on the other
   * needs a real second window, which an expanded panel in one tab cannot be.
   */
  it('offers a new tab only when there is a page to open', async () => {
    render();
    expect(screen.queryByRole('link', { name: /new tab/i })).not.toBeInTheDocument();

    render({ standalonePath: '/app/nodes/n1/shell' });
    const link = await screen.findByRole('link', { name: /new tab/i });
    expect(link).toHaveAttribute('href', '/app/nodes/n1/shell');
    expect(link).toHaveAttribute('target', '_blank');
    // Without this a new tab can reach back into the opener through window.opener.
    expect(link.getAttribute('rel')).toContain('noopener');
  });

  // A shell must not outlive the page: unmounting has to end the session, or one
  // stays open on the Operator's server for a tab that is already gone.
  it('closes the shell when the page goes away', async () => {
    const { unmount } = render();
    await userEvent.click(screen.getByRole('button', { name: /open a shell/i }));
    await waitFor(() => expect(FakeSocket.last).not.toBeNull());
    FakeSocket.last?.openIt();

    unmount();
    expect(FakeSocket.last?.readyState).toBe(3);
  });
});
