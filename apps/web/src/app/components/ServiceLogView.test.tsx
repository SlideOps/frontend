import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderInApp } from '../../test/render';
import { ServiceLogView } from './ServiceLogView';

/*
 * The live log viewer.
 *
 * What matters here is the streaming contract, not the styling: history arrives
 * once, new lines append without replacing what came before, a permanent
 * refusal shows the real reason rather than a generic failure, and a stopped
 * Service reads as "watching for it to come back" rather than as an error.
 */

class FakeSocket {
  static last: FakeSocket | null = null;
  static instances: FakeSocket[] = [];
  static readonly OPEN = 1;

  readyState = 0;
  private listeners: Record<string, Array<(event: unknown) => void>> = {};

  constructor(public url: string) {
    FakeSocket.last = this;
    FakeSocket.instances.push(this);
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

beforeEach(() => {
  FakeSocket.last = null;
  FakeSocket.instances = [];
  vi.stubGlobal('WebSocket', FakeSocket as unknown as typeof WebSocket);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ServiceLogView', () => {
  it('shows the recent history, then appends new lines without losing it', async () => {
    renderInApp(<ServiceLogView id="svc-1" />);
    FakeSocket.last!.openIt();
    FakeSocket.last!.message({ type: 'status', status: 'connected' });
    FakeSocket.last!.message({ type: 'history', data: 'starting up\nlistening on :8000' });

    expect(await screen.findByText('starting up')).toBeInTheDocument();
    expect(screen.getByText('listening on :8000')).toBeInTheDocument();

    FakeSocket.last!.message({ type: 'log', data: 'a request came in' });
    await waitFor(() => expect(screen.getByText('a request came in')).toBeInTheDocument());
    // The history is still there: this is appended output, not a replacement.
    expect(screen.getByText('starting up')).toBeInTheDocument();
  });

  it('shows Connected once the backend attaches, not merely once the socket opens', async () => {
    renderInApp(<ServiceLogView id="svc-1" />);
    expect(screen.getByText('Connecting…')).toBeInTheDocument();

    FakeSocket.last!.openIt();
    expect(screen.getByText('Connecting…')).toBeInTheDocument();

    FakeSocket.last!.message({ type: 'status', status: 'connected' });
    expect(await screen.findByText('Connected')).toBeInTheDocument();
  });

  it('shows the real reason when the backend refuses, not a generic failure', async () => {
    renderInApp(<ServiceLogView id="svc-1" />);
    FakeSocket.last!.openIt();
    FakeSocket.last!.message({ type: 'error', message: 'Service does not exist.' });

    expect(await screen.findByRole('alert')).toHaveTextContent('Service does not exist.');
  });

  it('reports a stopped Service as something it is watching for, not an error', async () => {
    renderInApp(<ServiceLogView id="svc-1" />);
    FakeSocket.last!.openIt();
    FakeSocket.last!.message({ type: 'status', status: 'stopped', message: 'Service stopped.' });

    expect(await screen.findByText(/Service stopped\..*Watching for it to start again\./)).toBeInTheDocument();
    // Not the same thing as a permanent failure.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('opens a new connection when the Operator asks to reconnect, keeping the scrollback', async () => {
    renderInApp(<ServiceLogView id="svc-1" />);
    FakeSocket.last!.openIt();
    FakeSocket.last!.message({ type: 'history', data: 'old output' });
    await screen.findByText('old output');

    expect(FakeSocket.instances).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: /reconnect/i }));

    await waitFor(() => expect(FakeSocket.instances).toHaveLength(2));
    // A reconnect is a fresh socket, not a fresh view: the moment an Operator
    // most needs the scrollback is exactly the moment something crashed and
    // the connection had to recover, so it must never be the moment it is lost.
    expect(screen.getByText('old output')).toBeInTheDocument();
  });

  // The backend sends history again on every fresh connection, including a
  // reconnect, because each one is a new follow from its side. Applying it a
  // second time would duplicate the same recent lines underneath themselves.
  it('does not duplicate history delivered again after a reconnect', async () => {
    renderInApp(<ServiceLogView id="svc-1" />);
    FakeSocket.last!.openIt();
    FakeSocket.last!.message({ type: 'history', data: 'starting up' });
    await screen.findByText('starting up');

    await userEvent.click(screen.getByRole('button', { name: /reconnect/i }));
    await waitFor(() => expect(FakeSocket.instances).toHaveLength(2));
    FakeSocket.last!.openIt();
    FakeSocket.last!.message({ type: 'history', data: 'starting up' });
    FakeSocket.last!.message({ type: 'log', data: 'still going' });

    await waitFor(() => expect(screen.getByText('still going')).toBeInTheDocument());
    expect(screen.getAllByText('starting up')).toHaveLength(1);
  });

  // A marker about the stream itself must be visible in context -- an
  // Operator reading a crash needs to see when the stream reconnected too --
  // but never mistakeable for something the workload printed.
  it('shows a stream diagnostic inline without treating it as workload output', async () => {
    renderInApp(<ServiceLogView id="svc-1" />);
    FakeSocket.last!.openIt();
    FakeSocket.last!.message({ type: 'diagnostic', message: '--- Service restarted ---' });
    FakeSocket.last!.message({ type: 'log', data: 'listening on :8000' });

    expect(await screen.findByText('--- Service restarted ---')).toBeInTheDocument();
    expect(screen.getByText('listening on :8000')).toBeInTheDocument();
  });

  // A replacement container's diagnostic carries its id and start time on
  // their own lines; they must survive as line breaks, not run together into
  // one unreadable sentence.
  it('preserves line breaks in a multi-line diagnostic', async () => {
    renderInApp(<ServiceLogView id="svc-1" />);
    FakeSocket.last!.openIt();
    FakeSocket.last!.message({
      type: 'diagnostic',
      message: 'Connected to replacement container.\nContainer ID: abc123abc123\nStarted: 2026-08-04T14:00:00Z',
    });

    let marker: HTMLElement | undefined;
    await waitFor(() => {
      marker = screen.getAllByRole('status').find((el) => el.textContent?.includes('Container ID'));
      expect(marker).toBeDefined();
    });
    expect(marker?.textContent).toContain('Connected to replacement container.');
    expect(marker?.textContent).toContain('Container ID: abc123abc123');
    expect(marker?.textContent).toContain('Started: 2026-08-04T14:00:00Z');
    expect(marker!).toHaveClass('whitespace-pre-line');
  });

  // The whole point of this feature: a crash's traceback must reach the
  // screen live, and must never be cleared by anything -- not a reconnect, not
  // a status change, not the Service being reported as stopped afterwards.
  it('never clears a traceback once it has arrived', async () => {
    renderInApp(<ServiceLogView id="svc-1" />);
    FakeSocket.last!.openIt();
    FakeSocket.last!.message({ type: 'log', data: 'Traceback (most recent call last):' });
    FakeSocket.last!.message({ type: 'log', data: 'ValueError: boom' });
    await screen.findByText('ValueError: boom');

    FakeSocket.last!.message({ type: 'status', status: 'stopped', message: 'Service stopped.' });
    await screen.findByText(/Service stopped\./);

    expect(screen.getByText('Traceback (most recent call last):')).toBeInTheDocument();
    expect(screen.getByText('ValueError: boom')).toBeInTheDocument();
  });

  // An Operator pasting this into a support ticket wants the whole picture --
  // the workload's own lines and the stream diagnostics between them -- in
  // the same order they are already reading it on screen.
  it('copies everything on screen, lines and diagnostics, in order', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });

    renderInApp(<ServiceLogView id="svc-1" />);
    FakeSocket.last!.openIt();
    FakeSocket.last!.message({ type: 'history', data: 'starting up' });
    await screen.findByText('starting up');
    FakeSocket.last!.message({ type: 'diagnostic', message: '--- Service restarted ---' });
    FakeSocket.last!.message({ type: 'log', data: 'listening on :8000' });
    await waitFor(() => expect(screen.getByText('listening on :8000')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /copy the log output/i }));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        'starting up\n--- Service restarted ---\nlistening on :8000',
      ),
    );
  });

  it('closes the socket when it unmounts, rather than leaving a session open', () => {
    const { unmount } = renderInApp(<ServiceLogView id="svc-1" />);
    const socket = FakeSocket.last!;
    socket.openIt();
    const closeSpy = vi.spyOn(socket, 'close');

    unmount();

    expect(closeSpy).toHaveBeenCalled();
  });
});
