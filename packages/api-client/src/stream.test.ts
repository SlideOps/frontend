import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  dockerContainerLogStreamUrl,
  dockerContainerShellUrl,
  openDockerContainerLogStream,
  openServiceLogStream,
  type ServiceLogConnectionState,
} from './stream';

/*
 * The Service log stream connection.
 *
 * What matters here is the reconnect policy: an ordinary drop reconnects, and a
 * permanent refusal from the backend (the Service is gone, or never had a
 * workload) does not turn into a loop of doomed retries. Decoding the frames is
 * the easy half; deciding when to stop trying again is the half worth pinning.
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
    this.emit('close', { wasClean: true, code: 1000, reason: '' });
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
  vi.useFakeTimers();
  FakeSocket.last = null;
  FakeSocket.instances = [];
  vi.stubGlobal('WebSocket', FakeSocket as unknown as typeof WebSocket);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function record() {
  const states: ServiceLogConnectionState[] = [];
  const history: string[] = [];
  const lines: string[] = [];
  const diagnostics: string[] = [];
  const handle = openServiceLogStream({
    serviceId: 'svc-1',
    url: 'ws://test/logs/stream',
    onHistory: (h) => history.push(h),
    onLine: (l) => lines.push(l),
    onStateChange: (s) => states.push(s),
    onDiagnostic: (m) => diagnostics.push(m),
  });
  return { states, history, lines, diagnostics, handle };
}

describe('openServiceLogStream', () => {
  it('delivers history once, then each line as it arrives', () => {
    const { history, lines } = record();
    const socket = FakeSocket.last!;
    socket.openIt();
    socket.message({ type: 'history', data: 'line1\nline2' });
    socket.message({ type: 'log', data: 'line3' });
    socket.message({ type: 'log', data: 'line4' });

    expect(history).toEqual(['line1\nline2']);
    expect(lines).toEqual(['line3', 'line4']);
  });

  it('keeps stream diagnostics apart from log lines', () => {
    const { lines, diagnostics } = record();
    const socket = FakeSocket.last!;
    socket.openIt();
    socket.message({ type: 'diagnostic', message: 'Docker stream attached.' });
    socket.message({ type: 'log', data: 'listening on :8000' });
    socket.message({ type: 'diagnostic', message: '--- Service restarted ---' });
    socket.message({ type: 'log', data: 'listening on :8000' });

    expect(diagnostics).toEqual(['Docker stream attached.', '--- Service restarted ---']);
    expect(lines).toEqual(['listening on :8000', 'listening on :8000']);
  });

  it('reports connection state changes from status frames', () => {
    const { states } = record();
    const socket = FakeSocket.last!;
    socket.openIt();
    socket.message({ type: 'status', status: 'connecting' });
    socket.message({ type: 'status', status: 'connected' });
    socket.message({ type: 'status', status: 'stopped', message: 'Service stopped.' });

    expect(states).toContain('connecting');
    expect(states).toContain('connected');
    expect(states).toContain('stopped');
  });

  it('reconnects with backoff when the socket drops for an ordinary reason', () => {
    record();
    const first = FakeSocket.last!;
    first.openIt();

    first.emit('close', { wasClean: false, code: 1006, reason: '' });
    vi.advanceTimersByTime(1000);

    expect(FakeSocket.instances.length).toBe(2);
  });

  it('does not reconnect after a permanent error from the backend', () => {
    const { states } = record();
    const first = FakeSocket.last!;
    first.openIt();
    first.message({ type: 'error', message: 'Service does not exist.' });
    first.emit('close', { wasClean: false, code: 1008, reason: 'Service does not exist.' });

    vi.advanceTimersByTime(30000);

    expect(FakeSocket.instances.length).toBe(1);
    expect(states.at(-1)).toBe('disconnected');
  });

  it('stops reconnecting once closed by the caller', () => {
    const { handle } = record();
    const first = FakeSocket.last!;
    first.openIt();
    handle.close();

    first.emit('close', { wasClean: true, code: 1000, reason: '' });
    vi.advanceTimersByTime(30000);

    expect(FakeSocket.instances.length).toBe(1);
  });
});

describe('the websockets on one Docker container', () => {
  it('addresses a container through the Node that runs the daemon', () => {
    // Through the Node and not through a Service, because this is the way into
    // a container SlideOps did not deploy and knows nothing else about.
    expect(dockerContainerLogStreamUrl('nd_1', 'shop-web')).toContain(
      '/nodes/nd_1/docker/containers/shop-web/logs/stream',
    );
    expect(dockerContainerShellUrl('nd_1', 'shop-web', 120, 40)).toContain(
      '/nodes/nd_1/docker/containers/shop-web/shell',
    );
  });

  it('carries the terminal size the way the Service and Node shells do', () => {
    const url = dockerContainerShellUrl('nd_1', 'shop-web', 120, 40);

    expect(url).toContain('cols=120');
    expect(url).toContain('rows=40');
  });

  it('encodes a Node id and a container name that are not URL safe', () => {
    const url = dockerContainerLogStreamUrl('nd/1', 'shop/web');

    expect(url).toContain('/nodes/nd%2F1/docker/containers/shop%2Fweb/logs/stream');
  });

  it('opens a ws or wss URL, never an http one', () => {
    expect(dockerContainerLogStreamUrl('nd_1', 'shop-web').startsWith('ws')).toBe(true);
  });
});

describe('openDockerContainerLogStream', () => {
  it('delivers history, lines and diagnostics exactly as the Service stream does', () => {
    const history: string[] = [];
    const lines: string[] = [];
    const diagnostics: string[] = [];
    openDockerContainerLogStream({
      nodeId: 'nd_1',
      containerRef: 'shop-web',
      url: 'ws://test/containers/logs/stream',
      onHistory: (h) => history.push(h),
      onLine: (l) => lines.push(l),
      onStateChange: () => {},
      onDiagnostic: (m) => diagnostics.push(m),
    });
    const socket = FakeSocket.last!;
    socket.openIt();
    socket.message({ type: 'history', data: 'boot' });
    socket.message({ type: 'diagnostic', message: 'Docker stream attached.' });
    socket.message({ type: 'log', data: 'listening on :8000' });

    expect(socket.url).toBe('ws://test/containers/logs/stream');
    expect(history).toEqual(['boot']);
    expect(lines).toEqual(['listening on :8000']);
    expect(diagnostics).toEqual(['Docker stream attached.']);
  });

  it('derives the container URL when none is given', () => {
    openDockerContainerLogStream({
      nodeId: 'nd_1',
      containerRef: 'shop-web',
      onHistory: () => {},
      onLine: () => {},
      onStateChange: () => {},
    });

    expect(FakeSocket.last!.url).toContain('/nodes/nd_1/docker/containers/shop-web/logs/stream');
  });

  it('does not reconnect after a permanent error, as the Service stream does not', () => {
    // The same client underneath, so the reconnect policy cannot drift between
    // the two: a container that no longer exists will not exist on a retry.
    const states: ServiceLogConnectionState[] = [];
    openDockerContainerLogStream({
      nodeId: 'nd_1',
      containerRef: 'shop-web',
      url: 'ws://test/containers/logs/stream',
      onHistory: () => {},
      onLine: () => {},
      onStateChange: (s) => states.push(s),
    });
    const first = FakeSocket.last!;
    first.openIt();
    first.message({ type: 'error', message: 'That container is gone.' });
    first.emit('close', { wasClean: false, code: 1008, reason: 'gone' });

    vi.advanceTimersByTime(30000);

    expect(FakeSocket.instances.length).toBe(1);
    expect(states.at(-1)).toBe('disconnected');
  });
});
