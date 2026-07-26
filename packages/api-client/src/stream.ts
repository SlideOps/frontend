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
  const base = apiBase();

  if (apiIsCrossOrigin()) {
    const url = new URL(base);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.pathname = `${url.pathname.replace(/\/$/, '')}/stream`;
    return url.toString();
  }

  if (typeof window === 'undefined' || !window.location) {
    return `ws://localhost${base}/stream`;
  }
  const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${scheme}://${window.location.host}${base}/stream`;
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
