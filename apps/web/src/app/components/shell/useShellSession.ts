import { useTheme } from '@slideops/design-system';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { terminalTheme } from '../terminal-theme';

/*
 * The connect/dispose/resize/theme machinery behind a single terminal, pulled
 * out of ShellTerminal so a tab strip can hold several of these at once (one
 * xterm Terminal and one WebSocket per tab) without duplicating the protocol
 * handling. ShellTerminal itself becomes a thin wrapper around one instance,
 * so its own behaviour -- and the tests written against it -- do not change.
 */

/** Terminal geometry is sent so the remote starts at the right size. */
function geometry(terminal: Terminal): { cols: number; rows: number } {
  return { cols: terminal.cols || 80, rows: terminal.rows || 24 };
}

export type ShellStatus = 'idle' | 'connecting' | 'open' | 'closed';

export interface UseShellSessionResult {
  /** Attach this to the element the terminal should render into. */
  containerRef: React.RefObject<HTMLDivElement>;
  status: ShellStatus;
  error: string | null;
  /** A terminal exists on the page, which is not the same as a live session -- see ShellTerminal. */
  attached: boolean;
  /** Shorthand for status is connecting or open. */
  live: boolean;
  open: () => void;
  close: () => void;
  /** Re-measures the container and tells the remote, for callers that resize the container themselves (an expand toggle, a tab becoming active). */
  refit: () => void;
  /** Sends raw input to the active session exactly as if it had been typed, for a snippet picker that fills in a command without inventing a second protocol. */
  send: (data: string) => void;
}

/**
 * One shell session: connect on demand, tear down on unmount, resync the
 * theme on toggle, and refit on request. `urlFor` should be stable (wrap it
 * in useCallback in the caller) since it is a dependency of `open`.
 */
export function useShellSession(urlFor: (cols: number, rows: number) => string): UseShellSessionResult {
  const { resolved } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  // Kept so the terminal can be refitted when the box changes size. Without a
  // handle on it, expanding grows the container and leaves the terminal at its
  // old geometry, which looks exactly like the expand having done nothing.
  const fitRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<ShellStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [attached, setAttached] = useState(false);

  const dispose = useCallback(() => {
    socketRef.current?.close();
    socketRef.current = null;
    terminalRef.current?.dispose();
    terminalRef.current = null;
    fitRef.current = null;
  }, []);

  const close = useCallback(() => {
    dispose();
    setAttached(false);
    setStatus('closed');
  }, [dispose]);

  // A shell must not outlive the page. Leaving one open would hold a session on
  // the Operator's server for a tab that is already gone.
  useEffect(() => dispose, [dispose]);

  const open = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    /*
     * Whatever was here is replaced rather than reused.
     *
     * This used to return early when a terminal already existed, and a shell that
     * ended on its own -- the Operator typed exit, or the server closed it --
     * disposed nothing, so the terminal stayed and every later press of "Open
     * again" hit that guard and did nothing at all. The control was there, it was
     * enabled, and it was dead until the page was reloaded, which is exactly what
     * a broken feature looks like from the outside.
     */
    dispose();
    setError(null);
    setStatus('connecting');
    setAttached(true);

    const terminal = new Terminal({
      cursorBlink: true,
      fontFamily: "'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
      fontSize: 13,
      scrollback: 5000,
      theme: terminalTheme(),
    });
    const fit = new FitAddon();
    fitRef.current = fit;
    terminal.loadAddon(fit);
    terminal.open(container);
    // Fitting measures the element, so it throws when the container has no
    // layout yet. The session is worth more than the initial size: connect
    // anyway and let the first resize settle it.
    try {
      fit.fit();
    } catch {
      // Nothing to do: the default geometry stands until the terminal resizes.
    }
    terminalRef.current = terminal;

    const { cols, rows } = geometry(terminal);
    const socket = new WebSocket(urlFor(cols, rows));
    socket.binaryType = 'arraybuffer';
    socketRef.current = socket;

    // Whether the handshake ever completed. It decides which of two very different
    // failures happened, and they must not be reported as the same thing.
    let upgraded = false;

    socket.addEventListener('open', () => {
      upgraded = true;
      setStatus('open');
      terminal.focus();
    });

    socket.addEventListener('message', (event) => {
      const data = event.data;
      if (data instanceof ArrayBuffer) {
        terminal.write(new Uint8Array(data));
        return;
      }
      if (typeof data === 'string') {
        terminal.write(data);
      }
    });

    socket.addEventListener('error', () => {
      /*
       * Only the handshake failing is reported here, and only as what it is.
       *
       * This message used to be shown for every failure, and it was a guess: a
       * browser gets no status, no body and no reason from a websocket handshake
       * that did not complete, so a stopped Service, a server that had changed its
       * host key and a real outage all arrived as one sentence about the network.
       * The server now upgrades first and says why down the socket, so the only
       * failures left here are the ones that never reached the API at all.
       */
      if (!upgraded) {
        setError(
          'The shell could not be opened. Your session may have expired, or SlideOps is not reachable.',
        );
      }
    });

    socket.addEventListener('close', (event) => {
      setStatus('closed');
      // The reason the server refused, in its own words. It wrote the same
      // sentence into the terminal above; this puts it where an Operator who has
      // already scrolled away will still see it.
      if (event.reason) {
        setError(event.reason);
      }
      // Writing into a terminal that has been disposed throws, and closing the
      // panel disposes it before this event arrives.
      if (terminalRef.current === terminal) {
        terminal.write('\r\n\x1b[2mDisconnected.\x1b[0m\r\n');
      }
    });

    // Every keystroke, unmodified. The terminal does not echo locally: the remote
    // does, which is what makes typing appear once rather than twice.
    terminal.onData((data) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(new TextEncoder().encode(data));
      }
    });

    // Resize is a text frame, so it can never be mistaken for something typed.
    const sendResize = () => {
      try {
        fit.fit();
      } catch {
        // Fitting throws while the element is detached; there is nothing to do.
        return;
      }
      if (socket.readyState === WebSocket.OPEN) {
        const size = geometry(terminal);
        socket.send(JSON.stringify({ type: 'resize', ...size }));
      }
    };
    terminal.onResize(() => sendResize());
    window.addEventListener('resize', sendResize);
    socket.addEventListener('close', () => window.removeEventListener('resize', sendResize));
  }, [urlFor, dispose]);

  // The theme is captured when the terminal opens. Recreating a live terminal to
  // restyle it would throw away the session and whatever was on screen, which is
  // a worse trade than colours that lag a theme switch until it is reopened.
  useEffect(() => {
    const terminal = terminalRef.current;
    if (terminal) {
      terminal.options.theme = terminalTheme();
    }
  }, [resolved]);

  const live = status === 'connecting' || status === 'open';

  const refit = useCallback(() => {
    const fit = fitRef.current;
    const terminal = terminalRef.current;
    if (!fit || !terminal) {
      return;
    }
    try {
      fit.fit();
    } catch {
      return;
    }
    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'resize', ...geometry(terminal) }));
    }
    terminal.focus();
  }, []);

  const send = useCallback((data: string) => {
    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(new TextEncoder().encode(data));
    }
  }, []);

  return { containerRef, status, error, attached, live, open, close, refit, send };
}
