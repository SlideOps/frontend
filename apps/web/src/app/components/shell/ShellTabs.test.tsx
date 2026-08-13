import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderInApp } from '../../../test/render';
import { ShellTabs } from './ShellTabs';

// Same stand-ins as ShellTerminal.test.tsx: what is under test is which tab
// owns which session, not how xterm renders.
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

class FakeSocket {
  static all: FakeSocket[] = [];
  static readonly OPEN = 1;
  readyState = 0;
  binaryType = '';
  sent: unknown[] = [];
  private listeners: Record<string, Array<(event: unknown) => void>> = {};

  constructor(public url: string) {
    FakeSocket.all.push(this);
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
  FakeSocket.all = [];
  vi.stubGlobal('WebSocket', FakeSocket as unknown as typeof WebSocket);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function render() {
  return renderInApp(
    <ShellTabs
      urlFor={(cols, rows) => `ws://test/shell?cols=${cols}&rows=${rows}`}
      scopeLabel="This server"
      scopeDetail="A shell on the server itself."
    />,
  );
}

describe('ShellTabs', () => {
  it('starts with one tab and opens its shell on request', async () => {
    render();
    await userEvent.click(screen.getByRole('button', { name: /open a shell/i }));
    await waitFor(() => expect(FakeSocket.all).toHaveLength(1));
  });

  it('opening a second tab does not touch the first tab’s session', async () => {
    render();
    await userEvent.click(screen.getByRole('button', { name: /open a shell/i }));
    await waitFor(() => expect(FakeSocket.all).toHaveLength(1));
    FakeSocket.all[0]!.openIt();

    await userEvent.click(screen.getByRole('button', { name: /open another shell tab/i }));
    await userEvent.click(screen.getByRole('button', { name: /open a shell/i }));
    await waitFor(() => expect(FakeSocket.all).toHaveLength(2));

    // The first tab's socket is untouched by opening the second.
    expect(FakeSocket.all[0]!.readyState).toBe(FakeSocket.OPEN);
  });

  it('keeps an inactive tab’s session alive when switching away and back', async () => {
    const { container } = render();
    // The tab strip's own label counter is process-wide, so the first tab's
    // number varies by test order; read it back rather than assume "Shell 1".
    const firstTabButton = container.querySelector('button[aria-pressed]') as HTMLButtonElement;
    const firstLabel = firstTabButton.textContent?.trim() ?? '';

    await userEvent.click(screen.getByRole('button', { name: /open a shell/i }));
    await waitFor(() => expect(FakeSocket.all).toHaveLength(1));
    FakeSocket.all[0]!.openIt();

    await userEvent.click(screen.getByRole('button', { name: /open another shell tab/i }));
    // Switch back to the first tab.
    await userEvent.click(screen.getByRole('button', { name: new RegExp(`^${firstLabel}$`) }));

    // No second connection was made by switching tabs.
    expect(FakeSocket.all).toHaveLength(1);
    expect(FakeSocket.all[0]!.readyState).toBe(FakeSocket.OPEN);
  });

  it('closing a tab ends its session', async () => {
    const { container } = render();
    const firstTabButton = container.querySelector('button[aria-pressed]') as HTMLButtonElement;
    const firstLabel = firstTabButton.textContent?.trim() ?? '';

    await userEvent.click(screen.getByRole('button', { name: /open a shell/i }));
    await waitFor(() => expect(FakeSocket.all).toHaveLength(1));
    FakeSocket.all[0]!.openIt();

    await userEvent.click(screen.getByRole('button', { name: new RegExp(`^Close ${firstLabel}$`) }));
    expect(FakeSocket.all[0]!.readyState).toBe(3);
  });
});
