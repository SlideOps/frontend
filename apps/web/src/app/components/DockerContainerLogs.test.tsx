import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderInApp } from '../../test/render';
import { DockerContainerLogs } from './DockerContainerLogs';

/*
 * One container's live output.
 *
 * The contract worth pinning is that nothing this view offers changes the log.
 * Search narrows what is on screen and leaves the text alone, clearing empties
 * the view and not the container's own log, and copying hands back every line
 * that arrived rather than the subset a filter happened to leave visible. A log
 * viewer that quietly edits, reorders or omits is worse than none: an Operator
 * reads it during an incident and believes it.
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
    <DockerContainerLogs nodeId="n1" containerRef={'f'.repeat(64)} containerName="api" />,
  );
}

beforeEach(() => {
  FakeSocket.last = null;
  vi.stubGlobal('WebSocket', FakeSocket as unknown as typeof WebSocket);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('DockerContainerLogs', () => {
  it('opens the container stream on the Node, not a Service stream', () => {
    show();

    expect(FakeSocket.last?.url).toContain('/nodes/n1/docker/containers/');
    expect(FakeSocket.last?.url).toContain('/logs/stream');
  });

  it('shows the recent history, then appends new lines without losing it', async () => {
    show();
    FakeSocket.last!.openIt();
    FakeSocket.last!.message({ type: 'history', data: 'booting\nlistening on :80' });

    expect(await screen.findByText('booting')).toBeInTheDocument();

    FakeSocket.last!.message({ type: 'log', data: 'GET / 200' });
    await waitFor(() => expect(screen.getByText('GET / 200')).toBeInTheDocument());
    expect(screen.getByText('booting')).toBeInTheDocument();
  });

  it('narrows to matching lines on search, leaving the text itself alone', async () => {
    const operator = userEvent.setup();
    show();
    FakeSocket.last!.openIt();
    FakeSocket.last!.message({ type: 'history', data: 'booting\nGET / 200' });
    await screen.findByText('booting');

    await operator.type(screen.getByRole('searchbox', { name: 'Search these logs' }), 'GET');

    expect(screen.queryByText('booting')).toBeNull();
    // The matched line is still the same characters: the highlight wraps them,
    // it does not rewrite them.
    expect(screen.getByText(/GET/)).toBeInTheDocument();
    expect(screen.getByText('1 of 2 lines match')).toBeInTheDocument();
  });

  it('clears only what is on screen, and says so', async () => {
    const operator = userEvent.setup();
    show();
    FakeSocket.last!.openIt();
    FakeSocket.last!.message({ type: 'history', data: 'booting' });
    await screen.findByText('booting');

    const clear = screen.getByRole('button', { name: 'Clear what is on screen' });
    expect(clear).toHaveAttribute('title', 'Clears this view only. Nothing is deleted on the server.');
    await operator.click(clear);

    expect(screen.queryByText('booting')).toBeNull();
  });

  it('keeps a stream diagnostic apart from the container\'s own output', async () => {
    show();
    FakeSocket.last!.openIt();
    FakeSocket.last!.message({ type: 'diagnostic', message: 'Reattached after a restart.' });

    const diagnostic = await screen.findByText('Reattached after a restart.');
    // A marker about the stream must never read as something the container
    // printed, so it is announced as a status rather than rendered as a line.
    expect(diagnostic).toHaveAttribute('role', 'status');
  });

  it('says a stopped container is being watched for, rather than reading as broken', async () => {
    show();
    FakeSocket.last!.message({ type: 'status', status: 'stopped', message: 'api is not running.' });

    expect(await screen.findByText(/Watching for it to start again/)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('offers arrival times as arrival times, never as the container\'s own clock', async () => {
    show();

    expect(screen.getByRole('button', { name: 'Show arrival times' })).toHaveAttribute(
      'title',
      'The time each line reached SlideOps, which is not a clock the container set',
    );
  });
});
