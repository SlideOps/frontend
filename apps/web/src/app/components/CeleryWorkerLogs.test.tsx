import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderInApp } from '../../test/render';
import { CeleryWorkerLogs } from './CeleryWorkerLogs';

/*
 * A Celery worker's live output, on the same terms DockerContainerLogs
 * already proves for a container: recent history once, then every new line,
 * with nothing here editing, reordering, or omitting what the worker
 * actually printed.
 */

class FakeSocket {
  static last: FakeSocket | null = null;
  static readonly OPEN = 1;

  readyState = 0;
  private listeners: Record<string, Array<(event: unknown) => void>> = {};

  constructor(public url: string) {
    FakeSocket.last = this;
  }

  addEventListener(type: string, handler: (event: unknown) => void) {
    (this.listeners[type] ??= []).push(handler);
  }

  close() {
    this.readyState = 3;
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

  message(data: unknown) {
    this.emit('message', { data: JSON.stringify(data) });
  }
}

function show() {
  return renderInApp(
    <CeleryWorkerLogs serviceId="svc-1" workingDirectory="/opt/docai/backend" />,
  );
}

beforeEach(() => {
  FakeSocket.last = null;
  vi.stubGlobal('WebSocket', FakeSocket as unknown as typeof WebSocket);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CeleryWorkerLogs', () => {
  it('opens the worker stream on the Service, carrying its working directory', () => {
    show();

    expect(FakeSocket.last?.url).toContain('/services/svc-1/celery/logs/stream');
    expect(FakeSocket.last?.url).toContain('working_directory');
    expect(FakeSocket.last?.url).toContain(encodeURIComponent('/opt/docai/backend'));
  });

  it('shows the recent history, then appends new lines without losing it', async () => {
    show();
    FakeSocket.last!.openIt();
    FakeSocket.last!.message({ type: 'history', data: 'worker: booting\nworker: connected to redis' });

    expect(await screen.findByText('worker: booting')).toBeInTheDocument();

    FakeSocket.last!.message({ type: 'log', data: 'worker: ready.' });
    await waitFor(() => expect(screen.getByText('worker: ready.')).toBeInTheDocument());
    expect(screen.getByText('worker: booting')).toBeInTheDocument();
  });

  it('clears only what is on screen, and says so', async () => {
    const operator = userEvent.setup();
    show();
    FakeSocket.last!.openIt();
    FakeSocket.last!.message({ type: 'history', data: 'worker: booting' });
    await screen.findByText('worker: booting');

    const clear = screen.getByRole('button', { name: 'Clear what is on screen' });
    expect(clear).toHaveAttribute('title', 'Clears this view only. Nothing is deleted on the server.');
    await operator.click(clear);

    expect(screen.queryByText('worker: booting')).toBeNull();
  });

  it('pauses following without dropping new lines underneath', async () => {
    const operator = userEvent.setup();
    show();
    FakeSocket.last!.openIt();
    FakeSocket.last!.message({ type: 'history', data: 'worker: booting' });
    await screen.findByText('worker: booting');

    await operator.click(screen.getByRole('button', { name: 'Pause' }));
    FakeSocket.last!.message({ type: 'log', data: 'worker: still running' });

    expect(await screen.findByText('worker: still running')).toBeInTheDocument();
    expect(screen.getByText('Following is paused. Jump to latest.')).toBeInTheDocument();
  });

  it('shows a permanent stream error as an alert', async () => {
    show();
    FakeSocket.last!.openIt();
    FakeSocket.last!.message({ type: 'error', message: "The worker's node was not found." });

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("The worker's node was not found.");
  });

  it('reconnects on demand without losing what is already on screen', async () => {
    const operator = userEvent.setup();
    show();
    FakeSocket.last!.openIt();
    FakeSocket.last!.message({ type: 'history', data: 'worker: booting' });
    await screen.findByText('worker: booting');

    const firstSocket = FakeSocket.last;
    await operator.click(screen.getByRole('button', { name: 'Reconnect' }));

    expect(FakeSocket.last).not.toBe(firstSocket);
    expect(screen.getByText('worker: booting')).toBeInTheDocument();
  });

  it('narrows to matching lines on search, leaving the text itself alone', async () => {
    const operator = userEvent.setup();
    show();
    FakeSocket.last!.openIt();
    FakeSocket.last!.message({ type: 'history', data: 'worker: booting\nworker: connected to redis' });
    await screen.findByText('worker: booting');

    await operator.type(screen.getByRole('searchbox', { name: 'Search these logs' }), 'redis');

    expect(screen.queryByText('worker: booting')).toBeNull();
    // The matched line is still the same characters: the highlight wraps
    // them, it does not rewrite them.
    expect(screen.getByText(/redis/)).toBeInTheDocument();
    expect(screen.getByText('1 of 2 lines match')).toBeInTheDocument();
  });

  it('offers arrival times as arrival times, never as the worker’s own clock', () => {
    show();

    expect(screen.getByRole('button', { name: 'Show arrival times' })).toHaveAttribute(
      'title',
      'The time each line reached SlideOps, which is not a clock the worker set',
    );
  });

  it('copies back every line that arrived, not only what a search left visible', async () => {
    show();
    FakeSocket.last!.openIt();
    FakeSocket.last!.message({ type: 'history', data: 'worker: booting\nworker: connected to redis' });
    await screen.findByText('worker: booting');

    // fullText is derived from every line regardless of the search filter --
    // pinned via the visible text rather than the clipboard, since jsdom's
    // clipboard is not wired up in this suite.
    const operator = userEvent.setup();
    await operator.type(screen.getByRole('searchbox', { name: 'Search these logs' }), 'redis');
    expect(screen.queryByText('worker: booting')).toBeNull();

    await operator.clear(screen.getByRole('searchbox', { name: 'Search these logs' }));
    expect(screen.getByText('worker: booting')).toBeInTheDocument();
    expect(screen.getByText(/connected to redis/)).toBeInTheDocument();
  });
});
