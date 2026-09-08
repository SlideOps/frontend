import { Button, Text } from '@slideops/design-system';
import { useCallback, useEffect, useState } from 'react';
import { TerminalSurface } from '../TerminalSurface';
import { useShellSession } from './useShellSession';

/*
 * One tab's session and its chrome, shared by every tab strip in the app
 * (ShellTabs, one target shared by every tab; the global Terminal page, one
 * target per tab). Kept mounted while inactive so its socket stays alive;
 * only hidden.
 */

/** A hidden tab has no layout, so its terminal is remeasured once the browser has given it one. */
const ACTIVATION_SETTLE_MS = 60;

export interface ShellTabPanelProps {
  active: boolean;
  /** Builds the websocket URL once the terminal's size is known. */
  urlFor: (cols: number, rows: number) => string;
  /** What this tab attaches to, shown before it is opened. */
  scopeLabel: string;
  /** Why opening it is worth understanding, in one sentence. */
  scopeDetail: string;
  /** Disables opening, with the reason, when there is nothing to attach to. */
  unavailableReason?: string;
  /** Registers this tab's raw-send function, for a snippet picker shared by the whole strip. */
  onSessionReady: (send: (data: string) => void) => void;
}

export function ShellTabPanel({
  active,
  urlFor,
  scopeLabel,
  scopeDetail,
  unavailableReason,
  onSessionReady,
}: ShellTabPanelProps) {
  const { containerRef, status, error, attached, live, open, close, refit, focus, send } =
    useShellSession(urlFor);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    onSessionReady(send);
    // onSessionReady is a fresh closure each render; send is the stable
    // identity that actually decides when this needs to re-run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [send]);

  // Becoming the active tab is a size change too: an inactive tab is hidden, so
  // its terminal was measured against a box with no layout at all.
  useEffect(() => {
    if (!active) {
      return;
    }
    const id = window.setTimeout(refit, ACTIVATION_SETTLE_MS);
    return () => window.clearTimeout(id);
  }, [active, refit]);

  const toggleExpanded = useCallback(
    (next: boolean) => {
      setExpanded(next);
      focus();
    },
    [focus],
  );

  return (
    // The tab is hidden rather than unmounted, so its socket and its scrollback
    // survive switching away and back. The surface inside keeps its own tree
    // shape across expanding, for the same reason.
    <div className={active ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
      <TerminalSurface
        // Named after its own target, so several tabs on one page do not offer a
        // screen reader three identical controls called "expand".
        label={`the terminal for ${scopeLabel}`}
        expanded={expanded}
        onExpandedChange={toggleExpanded}
        canExpand={attached}
        onResize={refit}
        contentRef={containerRef}
        contentHidden={!attached}
        // This tab is the whole point of the page it sits on, so it takes the
        // height it is given rather than a fixed one of its own.
        fill
        className="min-h-0 flex-1"
        toolbar={
          <Text variant="caption" tone="secondary">
            {unavailableReason ?? scopeDetail}
          </Text>
        }
        actions={
          live ? (
            <Button size="sm" variant="ghost" onClick={close}>
              Close
            </Button>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              onClick={open}
              disabled={Boolean(unavailableReason)}
              title={unavailableReason}
            >
              {status === 'closed' ? 'Open again' : `Open a shell (${scopeLabel})`}
            </Button>
          )
        }
        notice={
          error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null
        }
      />
    </div>
  );
}
