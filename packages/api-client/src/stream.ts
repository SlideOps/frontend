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
 * into a typed event. Long-running Operations publish their progress here so
 * the dashboard can show live plan execution and verification. Returns a handle
 * for closing the connection.
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
