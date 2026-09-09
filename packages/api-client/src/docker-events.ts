import { apiRequest, unwrap } from './http';
import { websocketUrl, type StreamHandle } from './stream';

/*
 * What Docker is doing right now, and what it did to a container that failed.
 *
 * Three reads live here, and all three answer questions about behaviour over
 * time rather than about the state of things: the daemon's own event stream,
 * the restart evidence for one container, and the recent samples behind a
 * usage figure. They are kept apart from docker.ts, which is the inventory --
 * what exists on the Node right now -- so that a screen asking "what is here"
 * and a screen asking "what has been happening" do not share one growing file.
 *
 * Why the event stream is not in stream.ts: that file carries one log client
 * shared by Services and containers, because a Service's output and a
 * container's output really are the same bytes read the same way. Docker's
 * event stream is a different contract -- typed event frames rather than text
 * lines, no history replay, and a terminal error frame that must stop rather
 * than reconnect -- so folding it in would mean bending a decoder two log
 * views depend on. The reconnect policy is deliberately identical, down to the
 * constants below, because two live connections in one app disagreeing about
 * how long to wait is a bug an Operator experiences as flakiness.
 *
 * Field names mirror the backend contract exactly, snake_case included.
 */

/* ------------------------------------------------------------------ *
 * The daemon's event stream
 * ------------------------------------------------------------------ */

/**
 * One thing Docker reported doing, in Docker's own vocabulary.
 *
 * `type` and `action` are the daemon's words, not ours: "container" / "die",
 * "volume" / "mount", "image" / "pull". They are carried through untranslated
 * on purpose. An Operator who reads `docker events` in a terminal must see the
 * same words here, and a friendlier invented verb ("stopped" for "die") would
 * be a claim about what happened rather than a report of what Docker said.
 *
 * `attributes` is whatever the daemon attached to the event: an exit code, an
 * image reference, a Compose label. It is a free-form map because Docker's own
 * is, and it differs per action.
 */
export interface DockerEvent {
  type: string;
  action: string;
  /** The id of the thing the event is about: a container, image, volume, network. */
  actor_id: string;
  /** The name Docker attached to that actor. May be empty for an actor with none. */
  actor_name: string;
  attributes: Record<string, string>;
  at: string;
}

/**
 * One frame off the event websocket.
 *
 * An `error` frame is terminal: it says the stream cannot continue and why.
 * There is no partial or recoverable error in this contract, which is what
 * lets the client below stop trying rather than reconnecting into the same
 * refusal forever.
 */
export type DockerEventFrame =
  | { kind: 'event'; event: DockerEvent }
  | { kind: 'error'; message: string };

/**
 * The connection as a screen reports it.
 *
 * `stopped` is the terminal state: the backend refused, said why, and this
 * client will not try again. It is deliberately distinct from `reconnecting`,
 * because "we are working on it" and "this is over" must never look the same
 * on a page somebody is watching during an incident.
 */
export type DockerEventConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'stopped';

export interface DockerEventStreamOptions {
  /** The Node running the daemon whose events to follow. */
  nodeId: string;
  /** Called for each event, in the order the daemon reported it. */
  onEvent: (event: DockerEvent) => void;
  /** Called on every connection state change, with the backend's own sentence
   * when it sent one. */
  onStateChange: (state: DockerEventConnectionState, detail?: string) => void;
  /** Override the derived URL, mainly for tests. */
  url?: string;
  /** The largest reconnect delay, in milliseconds. */
  maxBackoffMs?: number;
}

/**
 * The same two numbers the log stream uses. Named here rather than imported so
 * this file has no reach into stream.ts's internals, but chosen to match: a
 * reconnect that takes half a second in one live view and five in another is
 * inconsistency an Operator feels without being able to name it.
 */
const EVENT_STREAM_INITIAL_BACKOFF_MS = 500;
const EVENT_STREAM_DEFAULT_MAX_BACKOFF_MS = 15000;

/** The websocket carrying everything the daemon on this Node reports doing. */
export function dockerEventStreamUrl(nodeId: string): string {
  return websocketUrl(`/nodes/${encodeURIComponent(nodeId)}/docker/events/stream`);
}

/**
 * Follow Docker's own event stream on one Node.
 *
 * It connects to the cookie authenticated websocket, decodes each frame, and
 * reconnects the socket with backoff when it drops -- a dropped socket is a
 * network event, not an answer, and the daemon is still there.
 *
 * An error frame is the exception and ends the stream for good. Retrying a
 * refusal ("Docker is not running on this Node") would produce an endless
 * reconnect loop behind a screen that looks merely busy, which is the worst of
 * both: nothing works and nothing says so.
 */
export function openDockerEventStream(options: DockerEventStreamOptions): StreamHandle {
  const url = options.url ?? dockerEventStreamUrl(options.nodeId);
  const maxBackoff = options.maxBackoffMs ?? EVENT_STREAM_DEFAULT_MAX_BACKOFF_MS;

  let socket: WebSocket | null = null;
  let backoff = EVENT_STREAM_INITIAL_BACKOFF_MS;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;
  let permanentError: string | null = null;

  const connect = () => {
    if (closed) {
      return;
    }
    options.onStateChange(
      backoff === EVENT_STREAM_INITIAL_BACKOFF_MS ? 'connecting' : 'reconnecting',
    );
    socket = new WebSocket(url);

    socket.addEventListener('open', () => {
      backoff = EVENT_STREAM_INITIAL_BACKOFF_MS;
      options.onStateChange('connected');
    });

    socket.addEventListener('message', (message) => {
      let frame: DockerEventFrame;
      try {
        frame = JSON.parse(message.data as string) as DockerEventFrame;
      } catch {
        // A malformed frame should never take down the stream; skip it.
        return;
      }
      if (frame.kind === 'event' && frame.event) {
        options.onEvent(frame.event);
        return;
      }
      if (frame.kind === 'error') {
        permanentError = frame.message || 'Docker events could not be streamed.';
        options.onStateChange('stopped', permanentError);
      }
    });

    socket.addEventListener('close', () => {
      if (closed) {
        return;
      }
      if (permanentError) {
        // The backend already said why, and said it for good.
        closed = true;
        return;
      }
      scheduleReconnect();
    });

    socket.addEventListener('error', () => {
      // The close handler follows an error and drives the reconnect, so there
      // is nothing to do here beyond letting the socket settle.
    });
  };

  const scheduleReconnect = () => {
    options.onStateChange('reconnecting');
    reconnectTimer = setTimeout(() => {
      backoff = Math.min(backoff * 2, maxBackoff);
      connect();
    }, backoff);
  };

  connect();

  return {
    close: () => {
      closed = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      socket?.close();
    },
  };
}

/* ------------------------------------------------------------------ *
 * Why one container failed
 * ------------------------------------------------------------------ */

/**
 * One thing the backend observed about a failing container, in its own words.
 *
 * `code` is stable and machine-readable so a screen can key on it; `detail` is
 * the sentence to show. Both come from the backend and neither is rewritten
 * here: an observation is evidence somebody gathered, and paraphrasing
 * evidence in the browser is how a report acquires claims nobody made.
 */
export interface DockerCrashObservation {
  code: string;
  detail: string;
}

/**
 * What Docker recorded about a container that keeps stopping.
 *
 * Every optional field is optional because the daemon does not always have the
 * answer: a container that has never exited has no exit code, one that has
 * never restarted has no last restart time, one whose image declares no
 * healthcheck has no health status. An absent field is an absent fact, and a
 * screen must leave it out rather than fill it with "unknown", "none" or zero.
 *
 * There is deliberately no cause, verdict or diagnosis field, and none may be
 * added. This is the evidence Docker reported; deciding what it means is the
 * Operator's, and a tool that names a root cause it cannot know is wrong in
 * exactly the moment somebody is trusting it most.
 */
export interface DockerCrashAnalysis {
  restart_count: number;
  last_restart_at?: string;
  /** What the container was doing before the state it is in now. */
  previous_state?: string;
  exit_code?: number;
  /** True only when Docker itself recorded an OOM kill. */
  oom_killed: boolean;
  health_status?: string;
  /** Whether the backend judged the restarts to be a loop rather than churn. */
  crash_loop: boolean;
  /** The window the loop was measured over, when one was measured. */
  crash_loop_window_seconds?: number;
  /** How many restarts fell inside that window. */
  restarts_in_window?: number;
  observations: DockerCrashObservation[];
}

/**
 * Read the restart evidence for one container.
 *
 * A read: it inspects what the daemon already recorded and changes nothing.
 * `ref` is the id or the name, encoded rather than trusted, since whoever
 * created the container chose that name.
 */
export function getDockerCrashAnalysis(
  nodeId: string,
  ref: string,
  signal?: AbortSignal,
): Promise<DockerCrashAnalysis> {
  return apiRequest<unknown>(
    `/nodes/${encodeURIComponent(nodeId)}/docker/containers/${encodeURIComponent(ref)}/analysis`,
    { signal },
  ).then((r) => unwrap<DockerCrashAnalysis>(r, 'analysis'));
}

/* ------------------------------------------------------------------ *
 * Recent samples for one container
 * ------------------------------------------------------------------ */

/** How far back a metrics read goes. The backend defines the set; a range it
 * does not offer is not a range this client may ask for. */
export type DockerMetricsRange = '5m' | '30m' | '1h' | '6h' | '24h';

/** Every range the backend serves, in the order a picker should offer them. */
export const DOCKER_METRICS_RANGES: readonly DockerMetricsRange[] = [
  '5m',
  '30m',
  '1h',
  '6h',
  '24h',
];

/**
 * One recorded sample for a container.
 *
 * The same fields as a live sample, minus the ones nobody plots. As with the
 * live sample in docker.ts, `memory_limit_mb` is what the daemon reported as the
 * ceiling at sampling time, which for a container with no limit of its own is
 * the whole machine's memory and is not evidence that a limit was set.
 */
export interface DockerContainerMetricSample {
  sampled_at: string;
  cpu_percent: number;
  memory_used_mb: number;
  memory_limit_mb: number;
  net_rx_bytes: number;
  net_tx_bytes: number;
}

/**
 * Read the recent samples for one container.
 *
 * An empty list is a real answer: the container may have started a minute ago,
 * or nothing may have sampled it yet. It is not zero usage, and a caller must
 * not draw a flat line through it.
 */
export function listDockerContainerMetrics(
  nodeId: string,
  ref: string,
  range: DockerMetricsRange,
  signal?: AbortSignal,
): Promise<DockerContainerMetricSample[]> {
  return apiRequest<unknown>(
    `/nodes/${encodeURIComponent(nodeId)}/docker/containers/${encodeURIComponent(ref)}/metrics?range=${range}`,
    { signal },
  ).then((r) => unwrap<DockerContainerMetricSample[]>(r, 'samples'));
}
