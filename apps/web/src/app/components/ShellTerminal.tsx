import { Button, Text } from '@slideops/design-system';
import { ArrowUpRight, Terminal as TerminalIcon } from '@slideops/icons';
import { useCallback, useState } from 'react';
import { TerminalSurface } from './TerminalSurface';
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
 * The connect/dispose/resize/theme machinery lives in useShellSession, and the
 * box, its sizing, its expand control and the light under it live in
 * TerminalSurface, shared with every other terminal and log view in the app.
 * What is left here is the session chrome: open, close, and a link to the same
 * shell on a page of its own.
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
  const { containerRef, status, error, attached, live, open, close, refit, focus } =
    useShellSession(urlFor);
  const [expanded, setExpanded] = useState(false);

  // Expanding is a size change with no window resize behind it, so the caret is
  // put back deliberately: the control that was just pressed took it.
  const toggleExpanded = useCallback(
    (next: boolean) => {
      setExpanded(next);
      focus();
    },
    [focus],
  );

  return (
    <TerminalSurface
      label="the terminal"
      expanded={expanded}
      onExpandedChange={toggleExpanded}
      // Expanding an empty frame gives an Operator a full window of nothing.
      canExpand={attached}
      onResize={refit}
      contentRef={containerRef}
      // Shown while a terminal exists, which outlasts the session in it. Keyed on
      // the socket instead, the box vanished the instant a shell ended, taking the
      // server's parting words with it: a refusal is written into the terminal and
      // the socket closes immediately after, so the explanation and its hiding
      // place arrived together. Hidden rather than unmounted, so the terminal's own
      // element is still the one xterm was given.
      contentHidden={!attached}
      toolbar={
        <>
          <TerminalIcon width={16} height={16} className="text-brand" aria-hidden />
          <Text variant="body-sm" className="font-medium">
            {scopeLabel}
          </Text>
        </>
      }
      actions={
        <>
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
        </>
      }
      caption={
        <Text variant="caption" tone="secondary">
          {unavailableReason ?? scopeDetail}
        </Text>
      }
      notice={
        error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null
      }
    />
  );
}
