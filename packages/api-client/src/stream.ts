import { apiBase, apiIsCrossOrigin } from './http';
import type { OperationEvent } from './types';

export interface StreamHandlers<TEvent> {
  onEvent: (event: TEvent) => void;
  onOpen?: () => void;
  onError?: (error: Event) => void;
  onClose?: (event: CloseEvent) => void;
}

export interface StreamHandle {
  close: () => void;
}

/**
 * Open a websocket to the backend event stream and decode each JSON message
 * into a typed event. Returns a handle for closing the connection. This is the
 * low-level primitive; most callers want openOperationStream below.
 */
export function openEventStream<TEvent>(
  url: string,
  handlers: StreamHandlers<TEvent>,
): StreamHandle {
  const socket = new WebSocket(url);

  socket.addEventListener('open', () => handlers.onOpen?.());
  socket.addEventListener('error', (event) => handlers.onError?.(event));
  socket.addEventListener('close', (event) => handlers.onClose?.(event));
  socket.addEventListener('message', (message) => {
    try {
      handlers.onEvent(JSON.parse(message.data as string) as TEvent);
    } catch {
      // A malformed frame should never take down the stream; skip it.
    }
  });

  return {
    close: () => socket.close(),
  };
}

/**
 * Derive the websocket URL for the Operator event stream.
 *
 * It follows the API base rather than the page's own location, so a backend
 * deployed on another origin gets its stream opened against the backend and not
 * against wherever this page happens to be served from. When the base is a path,
 * which is the ordinary same-origin deployment, this resolves to the page origin
 * exactly as before.
 *
 * The scheme is upgraded alongside: wss for https, ws otherwise. The session
 * cookie rides the upgrade request, which is what authenticates the stream.
 */
export function operationStreamUrl(): string {
  return websocketUrl('/stream');
}

/**
 * Derive a websocket URL for a backend path, following the API base rather than
 * the page's own location, so a backend deployed on another origin is reached at
 * the backend. The scheme is upgraded alongside: wss for https, ws otherwise.
 * The session cookie rides the upgrade request, which is what authenticates it.
 */
export function websocketUrl(path: string, query?: Record<string, string | number>): string {
  const base = apiBase();
  const search = query
    ? `?${new URLSearchParams(
        Object.entries(query).map(([key, value]) => [key, String(value)]),
      ).toString()}`
    : '';

  if (apiIsCrossOrigin()) {
    const url = new URL(base);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.pathname = `${url.pathname.replace(/\/$/, '')}${path}`;
    return `${url.toString()}${search}`;
  }

  if (typeof window === 'undefined' || !window.location) {
    return `ws://localhost${base}${path}${search}`;
  }
  const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${scheme}://${window.location.host}${base}${path}${search}`;
}

/** The websocket carrying an interactive terminal on a Node: the whole server. */
export function nodeShellUrl(nodeID: string, cols: number, rows: number): string {
  return websocketUrl(`/nodes/${encodeURIComponent(nodeID)}/shell`, { cols, rows });
}

/** The websocket carrying a shell scoped to one Service's own container. */
export function serviceShellUrl(serviceID: string, cols: number, rows: number): string {
  return websocketUrl(`/services/${encodeURIComponent(serviceID)}/shell`, { cols, rows });
}

/** The websocket carrying a Service's live output: recent history, then every
 * new line as the workload prints it. */
export function serviceLogStreamUrl(serviceID: string): string {
  return websocketUrl(`/services/${encodeURIComponent(serviceID)}/logs/stream`);
}

/**
 * One frame of a Service log stream. `type` says what the rest means:
 * `history` and `log` carry `data`, the workload's own text; `status` carries
 * a connection state and an optional human sentence for it; `error` means the
 * stream cannot continue and `message` says why.
 */
export interface ServiceLogFrame {
  type: 'history' | 'log' | 'status' | 'error';
  data?: string;
  status?: string;
  message?: string;
}

export type ServiceLogConnectionState =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'stopped'
  | 'disconnected'
  | 'stream_ended';

export interface ServiceLogStreamOptions {
  /** The Service whose live output to follow. */
  serviceId: string;
  /** Called once with the recent output, before anything else. */
  onHistory: (history: string) => void;
  /** Called for each new line, in the order it was printed. */
  onLine: (line: string) => void;
  /** Called on every connection state change, with a human sentence when the
   * backend sent one (otherwise a default for the state). */
  onStateChange: (state: ServiceLogConnectionState, detail?: string) => void;
  /** Override the derived URL, mainly for tests. */
  url?: string;
  /** The largest reconnect delay, in milliseconds. */
  maxBackoffMs?: number;
}

const LOG_STREAM_INITIAL_BACKOFF_MS = 500;
const LOG_STREAM_DEFAULT_MAX_BACKOFF_MS = 15000;

const LOG_STATUS_STATE: Record<string, ServiceLogConnectionState> = {
  connecting: 'connecting',
  connected: 'connected',
  reconnecting: 'reconnecting',
  stopped: 'stopped',
};

/**
 * Open a Service's live output. It connects to the cookie authenticated
 * websocket, delivers the recent history once and every new line after it as
 * the backend follows the workload, and reconnects the socket itself with
 * backoff if the connection drops -- the backend already reconnects the
 * follow command on its own side of that same socket, so this only has to
 * cover the socket going away entirely, not the ordinary hiccups inside it.
 *
 * An error frame from the backend (the Service does not exist, or never had a
 * workload to read) is permanent: the socket closing right after one does not
 * trigger a reconnect, since nothing about retrying would change the answer.
 * Close the returned handle to stop for good; that, too, does not reconnect.
 */
export function openServiceLogStream(options: ServiceLogStreamOptions): StreamHandle {
  const url = options.url ?? serviceLogStreamUrl(options.serviceId);
  const maxBackoff = options.maxBackoffMs ?? LOG_STREAM_DEFAULT_MAX_BACKOFF_MS;

  let socket: WebSocket | null = null;
  let backoff = LOG_STREAM_INITIAL_BACKOFF_MS;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;
  let permanentError: string | null = null;

  const setState = (state: ServiceLogConnectionState, detail?: string) =>
    options.onStateChange(state, detail);

  const connect = () => {
    if (closed) {
      return;
    }
    setState(backoff === LOG_STREAM_INITIAL_BACKOFF_MS ? 'connecting' : 'reconnecting');
    socket = new WebSocket(url);

    socket.addEventListener('open', () => {
      backoff = LOG_STREAM_INITIAL_BACKOFF_MS;
    });

    socket.addEventListener('message', (message) => {
      let frame: ServiceLogFrame;
      try {
        frame = JSON.parse(message.data as string) as ServiceLogFrame;
      } catch {
        // A malformed frame should never take down the stream; skip it.
        return;
      }
      switch (frame.type) {
        case 'history':
          options.onHistory(frame.data ?? '');
          break;
        case 'log':
          options.onLine(frame.data ?? '');
          break;
        case 'status':
          setState(LOG_STATUS_STATE[frame.status ?? ''] ?? 'connecting', frame.message);
          break;
        case 'error':
          permanentError = frame.message ?? 'The service logs could not be streamed.';
          setState('disconnected', permanentError);
          break;
      }
    });

    socket.addEventListener('close', (event) => {
      if (closed) {
        setState('disconnected');
        return;
      }
      if (permanentError) {
        // The backend already said why, and said it for good: retrying would
        // only reconnect to the same answer.
        closed = true;
        return;
      }
      if (event.wasClean && event.code === 1000 && !event.reason) {
        setState('stream_ended');
      }
      scheduleReconnect();
    });

    socket.addEventListener('error', () => {
      // The close handler follows an error and drives the reconnect; nothing
      // to do here beyond letting the socket settle.
    });
  };

  const scheduleReconnect = () => {
    setState('reconnecting');
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

export type StreamStatus = 'connecting' | 'open' | 'reconnecting' | 'closed';

export interface OperationStreamOptions {
  /** Called for every decoded Operation event, replayed or live. */
  onEvent: (event: OperationEvent) => void;
  /** Called when the connection status changes, for a live indicator. */
  onStatusChange?: (status: StreamStatus) => void;
  /** Override the derived URL, mainly for tests. */
  url?: string;
  /** The largest reconnect delay, in milliseconds. */
  maxBackoffMs?: number;
}

const INITIAL_BACKOFF_MS = 500;
const DEFAULT_MAX_BACKOFF_MS = 15000;

/**
 * Subscribe to the Operator's Operation events. It connects to the cookie
 * authenticated stream, decodes each JSON frame into a typed OperationEvent, and
 * reconnects with exponential backoff if the connection drops. Close the handle
 * to stop; an intentional close does not reconnect.
 */
export function openOperationStream(options: OperationStreamOptions): StreamHandle {
  const url = options.url ?? operationStreamUrl();
  const maxBackoff = options.maxBackoffMs ?? DEFAULT_MAX_BACKOFF_MS;

  let socket: WebSocket | null = null;
  let backoff = INITIAL_BACKOFF_MS;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;

  const setStatus = (status: StreamStatus) => options.onStatusChange?.(status);

  const connect = () => {
    if (closed) {
      return;
    }
    setStatus(backoff === INITIAL_BACKOFF_MS ? 'connecting' : 'reconnecting');
    socket = new WebSocket(url);

    socket.addEventListener('open', () => {
      backoff = INITIAL_BACKOFF_MS;
      setStatus('open');
    });

    socket.addEventListener('message', (message) => {
      try {
        options.onEvent(JSON.parse(message.data as string) as OperationEvent);
      } catch {
        // A malformed frame should never take down the stream; skip it.
      }
    });

    socket.addEventListener('close', () => {
      if (closed) {
        setStatus('closed');
        return;
      }
      scheduleReconnect();
    });

    socket.addEventListener('error', () => {
      // The close handler follows an error and drives the reconnect, so there is
      // nothing to do here beyond letting the socket settle.
    });
  };

  const scheduleReconnect = () => {
    setStatus('reconnecting');
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
