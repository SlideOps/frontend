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

  it('opens a new connection when the Operator asks to reconnect', async () => {
    renderInApp(<ServiceLogView id="svc-1" />);
    FakeSocket.last!.openIt();
    FakeSocket.last!.message({ type: 'history', data: 'old output' });
    await screen.findByText('old output');

    expect(FakeSocket.instances).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: /reconnect/i }));

    await waitFor(() => expect(FakeSocket.instances).toHaveLength(2));
    // Reconnecting starts the view over, rather than appending a second history
    // block underneath the first.
    expect(screen.queryByText('old output')).not.toBeInTheDocument();
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
