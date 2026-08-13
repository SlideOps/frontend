import { Button, Text } from '@slideops/design-system';
import { ArrowUpRight, Maximize2, Minimize2, Terminal as TerminalIcon } from '@slideops/icons';
import { useEffect, useState } from 'react';
import { useShellSession } from './shell/useShellSession';

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
 *
 * The connect/dispose/resize/theme machinery lives in useShellSession; this
 * component is the single-session chrome around it (expand, close, standalone
 * link). ShellTabs builds the multi-session chrome around the same hook.
 */

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

export function ShellTerminal({
  urlFor,
  scopeLabel,
  scopeDetail,
  unavailableReason,
  standalonePath,
}: ShellTerminalProps) {
  const { containerRef, status, error, attached, live, open, close, refit } = useShellSession(urlFor);
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
    // After the browser has applied the new layout, not before it.
    const id = window.setTimeout(refit, 60);
    return () => window.clearTimeout(id);
  }, [expanded, refit]);

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
