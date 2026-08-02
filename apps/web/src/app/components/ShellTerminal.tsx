import { Button, Text, useTheme } from '@slideops/design-system';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { ArrowUpRight, Maximize2, Minimize2, Terminal as TerminalIcon } from '@slideops/icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { terminalTheme } from './terminal-theme';

/*
 * A real terminal, not a command box.
 *
 * Keystrokes go to the server as they are typed and output comes back as it is
 * produced, both as binary frames, so this behaves the way a terminal is expected
 * to: a prompt, line editing, history, Ctrl-C, and full screen programs like top
 * and vim. Anything less would be a form that runs commands, which is a different
 * and much worse thing to be given when you asked for a shell.
 *
 * The terminal is only opened when the Operator asks for it. A shell that
 * connected on page load would open a session on someone's server because they
 * looked at a page, and every one of those is written to the audit trail.
 */

/** Terminal geometry is sent so the remote starts at the right size. */
function geometry(terminal: Terminal): { cols: number; rows: number } {
  return { cols: terminal.cols || 80, rows: terminal.rows || 24 };
}

export interface ShellTerminalProps {
  /** Builds the websocket URL once the terminal's size is known. */
  urlFor: (cols: number, rows: number) => string;
  /** What this terminal attaches to, shown before it is opened. */
  scopeLabel: string;
  /** Why opening it is worth understanding, in one sentence. */
  scopeDetail: string;
  /** Disables opening, with the reason, when there is nothing to attach to. */
  unavailableReason?: string;
  /**
   * Where this same shell can be opened on a page of its own.
   *
   * Given, an "open in a new tab" control appears beside the expand control. A
   * terminal is the one thing people want on a second monitor while they read
   * something else on the first, and expanding it in place cannot do that.
   */
  standalonePath?: string;
}

type Status = 'idle' | 'connecting' | 'open' | 'closed';

export function ShellTerminal({
  urlFor,
  scopeLabel,
  scopeDetail,
  unavailableReason,
  standalonePath,
}: ShellTerminalProps) {
  const { resolved } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  // Kept so the terminal can be refitted when the box changes size. Without a
  // handle on it, expanding grows the container and leaves the terminal at its
  // old geometry, which looks exactly like the expand having done nothing.
  const fitRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  /*
   * Whether a terminal exists on the page, which is not the same as a live
   * session.
   *
   * The box used to be shown only while the socket was connecting or open, and a
   * shell that ends says its last words on the way out: the server writes why it
   * refused, then closes. Keyed on the socket, the terminal was hidden in the same
   * instant that the explanation arrived in it, so the one message worth reading
   * was the one nobody could. It stays until the Operator opens another.
   */
  const [attached, setAttached] = useState(false);
  /*
   * Expanded fills the window rather than entering the browser's own fullscreen.
   *
   * Native fullscreen takes over the whole screen and hides the tab strip and the
   * address bar, which is disorienting for something you are working in rather
   * than watching. Filling the window keeps the browser where it is and still
   * gives the terminal every pixel of the page, which is what somebody reading a
   * long log actually wanted.
   */
  const [expanded, setExpanded] = useState(false);

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
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
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

  // Escape leaves the expanded view, because that is what Escape does everywhere
  // else and a control you can enter and not leave by reflex is a trap.
  useEffect(() => {
    if (!expanded) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setExpanded(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded]);

  /*
   * The terminal has to be told the size changed.
   *
   * xterm measures its container once and keeps that geometry. Growing the box
   * without refitting leaves an eighty column terminal in the middle of a wide
   * window, which looks like the expand did nothing. The remote is told too, or
   * anything drawing a full screen interface, top or vim, keeps painting at the
   * old size.
   */
  useEffect(() => {
    const fit = fitRef.current;
    const terminal = terminalRef.current;
    const socket = socketRef.current;
    if (!fit || !terminal) {
      return;
    }
    // After the browser has applied the new layout, not before it.
    const id = window.setTimeout(() => {
      try {
        fit.fit();
      } catch {
        return;
      }
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'resize', ...geometry(terminal) }));
      }
      terminal.focus();
    }, 60);
    return () => window.clearTimeout(id);
  }, [expanded]);

  return (
    <div
      className={
        expanded
          ? // Fixed rather than a modal: there is nothing to dismiss by clicking
            // away, and a shell that closed because somebody clicked beside it
            // would be a very unwelcome surprise mid command.
            'fixed inset-0 z-50 flex flex-col gap-3 bg-app p-4'
          : 'flex flex-col gap-3'
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <TerminalIcon width={16} height={16} className="text-brand" aria-hidden />
        <Text variant="body-sm" className="font-medium">
          {scopeLabel}
        </Text>

        {/* The size and window controls sit to the right, where a window's
            controls are, and only once there is something to resize. */}
        <span className="ml-auto flex items-center gap-1">
          {attached ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setExpanded((was) => !was)}
              title={expanded ? 'Leave full screen (Esc)' : 'Fill the window'}
              aria-label={expanded ? 'Leave full screen' : 'Fill the window'}
              aria-pressed={expanded}
            >
              {expanded ? (
                <Minimize2 width={15} height={15} aria-hidden />
              ) : (
                <Maximize2 width={15} height={15} aria-hidden />
              )}
            </Button>
          ) : null}
          {standalonePath ? (
            <a
              href={standalonePath}
              target="_blank"
              rel="noopener noreferrer"
              title="Open this shell in a new tab"
              aria-label="Open this shell in a new tab"
              className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-sm text-ink-muted transition-colors duration-fast ease-standard hover:bg-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              <ArrowUpRight width={15} height={15} aria-hidden />
            </a>
          ) : null}
        </span>

        {live ? (
          <Button size="sm" variant="ghost" onClick={close}>
            Close
          </Button>
        ) : (
          <>
            <Button
              size="sm"
              variant="secondary"
              onClick={open}
              disabled={Boolean(unavailableReason)}
              title={unavailableReason}
            >
              {status === 'closed' ? 'Open again' : 'Open a shell'}
            </Button>
            {/* A terminal whose session has ended is still on the page, holding
                what it said as it went. Dismissing it has to be possible without
                starting another session on the Operator's server. */}
            {attached ? (
              <Button size="sm" variant="ghost" onClick={close}>
                Close
              </Button>
            ) : null}
          </>
        )}
      </div>

      {expanded ? null : (
        <Text variant="caption" tone="secondary">
          {unavailableReason ?? scopeDetail}
        </Text>
      )}

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      {/* Shown while a terminal exists, which outlasts the session in it.
          Keyed on the socket instead, the box vanished the instant a shell ended,
          taking the server's parting words with it: a refusal is written into the
          terminal and the socket closes immediately after, so the explanation and
          its hiding place arrived together. Closing disposes the terminal, and a
          disposed terminal has taken its own elements out of the DOM, so this must
          not outlast that or it is a frame around genuinely nothing. */}
      {/* Expanded, the box takes the rest of the window instead of a fixed
          height, which is the entire point: a long log or a full screen program
          gets every row the screen has. */}
      <div
        ref={containerRef}
        className={`min-w-0 overflow-hidden rounded-md border border-border bg-app ${
          attached ? 'block' : 'hidden'
        } ${expanded ? 'min-h-0 flex-1' : ''}`}
        style={expanded ? undefined : { height: '24rem' }}
      />
    </div>
  );
}
