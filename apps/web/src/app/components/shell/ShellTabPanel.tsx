import { Button, Text } from '@slideops/design-system';
import { useEffect } from 'react';
import { useShellSession } from './useShellSession';

/*
 * One tab's session and its chrome, shared by every tab strip in the app
 * (ShellTabs, one target shared by every tab; the global Terminal page, one
 * target per tab). Kept mounted while inactive so its socket stays alive;
 * only hidden.
 */

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
  const { containerRef, status, error, attached, live, open, close, send } = useShellSession(urlFor);

  useEffect(() => {
    onSessionReady(send);
    // onSessionReady is a fresh closure each render; send is the stable
    // identity that actually decides when this needs to re-run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [send]);

  return (
    <div className={`min-h-0 flex-1 flex-col gap-2 ${active ? 'flex' : 'hidden'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Text variant="caption" tone="secondary">
          {unavailableReason ?? scopeDetail}
        </Text>
        <span className="ml-auto">
          {live ? (
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
          )}
        </span>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div
        ref={containerRef}
        className={`min-w-0 flex-1 overflow-hidden rounded-md border border-border bg-app ${
          attached ? 'block' : 'hidden'
        }`}
      />
    </div>
  );
}
