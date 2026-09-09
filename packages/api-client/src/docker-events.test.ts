import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  dockerEventStreamUrl,
  getDockerCrashAnalysis,
  listDockerContainerMetrics,
  openDockerEventStream,
  type DockerEvent,
  type DockerEventConnectionState,
} from './docker-events';

/*
 * The Docker events stream and the two diagnostic reads beside it.
 *
 * What matters here is the same thing that matters in stream.test.ts: an
 * ordinary drop reconnects, and a terminal refusal from the backend stops for
 * good instead of becoming an invisible loop of doomed retries. The reads are
 * asserted for the plainer property that they are GETs against the container
 * they name and that the envelope is unwrapped.
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

  drop() {
    this.readyState = 3;
    this.emit('close', { wasClean: false, code: 1006, reason: '' });
  }

  message(data: unknown) {
    this.emit('message', { data: JSON.stringify(data) });
  }
}

/** Build a Response-like stub for the mocked fetch. */
function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  } as unknown as Response;
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
  vi.restoreAllMocks();
});

function record() {
  const events: DockerEvent[] = [];
  const states: DockerEventConnectionState[] = [];
  const details: (string | undefined)[] = [];
  const handle = openDockerEventStream({
    nodeId: 'node-1',
    url: 'ws://test/docker/events/stream',
    onEvent: (event) => events.push(event),
    onStateChange: (state, detail) => {
      states.push(state);
      details.push(detail);
    },
  });
  return { events, states, details, handle };
}

const containerDie: DockerEvent = {
  type: 'container',
  action: 'die',
  actor_id: 'c1c1c1c1c1c1',
  actor_name: 'api',
  attributes: { exitCode: '137', image: 'ghcr.io/acme/api:1.4.0' },
  at: '2026-02-01T10:00:00Z',
};

describe('openDockerEventStream', () => {
  it('delivers each event frame in the order the daemon reported it', () => {
    const { events } = record();
    const socket = FakeSocket.last!;
    socket.openIt();
    socket.message({ kind: 'event', event: containerDie });
    socket.message({
      kind: 'event',
      event: { ...containerDie, action: 'start', attributes: {}, at: '2026-02-01T10:00:02Z' },
    });

    expect(events.map((event) => event.action)).toEqual(['die', 'start']);
    // Docker's own words, carried through untouched.
    expect(events[0].attributes.exitCode).toBe('137');
  });

  it('reports connected only once the socket is open', () => {
    const { states } = record();
    expect(states).toEqual(['connecting']);
    FakeSocket.last!.openIt();
    expect(states).toEqual(['connecting', 'connected']);
  });

  it('reconnects with backoff after an ordinary drop', () => {
    const { states } = record();
    FakeSocket.last!.openIt();
    FakeSocket.last!.drop();

    expect(states).toContain('reconnecting');
    expect(FakeSocket.instances).toHaveLength(1);
    vi.advanceTimersByTime(500);
    expect(FakeSocket.instances).toHaveLength(2);
  });

  it('stops for good on a terminal error frame rather than retrying the same refusal', () => {
    const { states, details } = record();
    const socket = FakeSocket.last!;
    socket.openIt();
    socket.message({ kind: 'error', message: 'Docker is not running on this server.' });

    expect(states.at(-1)).toBe('stopped');
    expect(details.at(-1)).toBe('Docker is not running on this server.');

    socket.drop();
    vi.advanceTimersByTime(60000);
    // One socket, ever: the refusal was an answer, not a network hiccup.
    expect(FakeSocket.instances).toHaveLength(1);
    expect(states.at(-1)).toBe('stopped');
  });

  it('survives a malformed frame instead of tearing the stream down', () => {
    const { events, states } = record();
    const socket = FakeSocket.last!;
    socket.openIt();
    socket.emit('message', { data: 'not json' });
    socket.message({ kind: 'event', event: containerDie });

    expect(events).toHaveLength(1);
    expect(states.at(-1)).toBe('connected');
  });

  it('does not reconnect once the caller closes the handle', () => {
    const { handle } = record();
    FakeSocket.last!.openIt();
    handle.close();
    vi.advanceTimersByTime(60000);

    expect(FakeSocket.instances).toHaveLength(1);
  });

  it('derives the stream URL from the Node, encoding the id', () => {
    expect(dockerEventStreamUrl('node/1')).toContain('/nodes/node%2F1/docker/events/stream');
  });
});

describe('the diagnostic reads', () => {
  it('reads the crash analysis for one container and unwraps the envelope', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        analysis: {
          restart_count: 9,
          last_restart_at: '2026-02-01T10:00:00Z',
          exit_code: 137,
          oom_killed: true,
          crash_loop: true,
          crash_loop_window_seconds: 300,
          restarts_in_window: 6,
          observations: [{ code: 'oom_killed', detail: 'The kernel killed this container.' }],
        },
      }),
    );

    const analysis = await getDockerCrashAnalysis('node-1', 'api');

    expect(analysis.restart_count).toBe(9);
    expect(analysis.observations).toHaveLength(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/nodes/node-1/docker/containers/api/analysis');
    expect((init as RequestInit | undefined)?.method ?? 'GET').toBe('GET');
  });

  it('encodes a container name that is not a safe path segment', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(200, { samples: [] }));

    await listDockerContainerMetrics('node-1', 'stack/web', '1h');

    expect(String(fetchMock.mock.calls[0][0])).toContain(
      '/nodes/node-1/docker/containers/stack%2Fweb/metrics?range=1h',
    );
  });

  it('returns the samples as the backend recorded them, empty list included', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        samples: [
          {
            sampled_at: '2026-02-01T10:00:00Z',
            cpu_percent: 12.5,
            memory_used_mb: 240,
            memory_limit_mb: 512,
            net_rx_bytes: 100,
            net_tx_bytes: 200,
          },
        ],
      }),
    );

    const samples = await listDockerContainerMetrics('node-1', 'api', '5m');
    expect(samples).toHaveLength(1);
    expect(samples[0].cpu_percent).toBe(12.5);
  });
});
