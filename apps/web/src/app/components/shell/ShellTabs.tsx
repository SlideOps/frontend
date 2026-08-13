import { Button, Text } from '@slideops/design-system';
import { Plus, Terminal as TerminalIcon, X } from '@slideops/icons';
import { useEffect, useRef, useState } from 'react';
import { SnippetPicker } from './SnippetPicker';
import { useShellSession } from './useShellSession';

/*
 * Several independent shells on one page.
 *
 * The websocket protocol dials a fresh SSH session per connection with no
 * server-side session registry, so N tabs is simply N independent
 * useShellSession instances -- nothing about opening a second one is special.
 * Inactive tabs stay mounted, only hidden with CSS, so their sockets and
 * scrollback survive switching away and back; only closing a tab tears its
 * session down, the same way closing the single terminal in ShellTerminal does.
 */

export interface ShellTabsProps {
  /** Builds the websocket URL for a tab once its terminal's size is known. */
  urlFor: (cols: number, rows: number) => string;
  /** What every tab attaches to, shown before each is opened. */
  scopeLabel: string;
  /** Why opening a shell here is worth understanding, in one sentence. */
  scopeDetail: string;
  /** Disables opening a new tab's shell, with the reason, when there is nothing to attach to. */
  unavailableReason?: string;
}

interface Tab {
  id: string;
  label: string;
}

let nextTabSerial = 1;

export function ShellTabs({ urlFor, scopeLabel, scopeDetail, unavailableReason }: ShellTabsProps) {
  const [tabs, setTabs] = useState<Tab[]>(() => [{ id: crypto.randomUUID(), label: `Shell ${nextTabSerial++}` }]);
  const [activeId, setActiveId] = useState<string>(() => tabs[0]?.id ?? '');
  // Registered by each tab's own session, so the snippet picker -- one
  // instance for the whole strip -- can reach whichever tab is active without
  // every tab re-rendering when another tab's session changes.
  const sendersRef = useRef<Record<string, (data: string) => void>>({});

  const addTab = () => {
    const tab = { id: crypto.randomUUID(), label: `Shell ${nextTabSerial++}` };
    setTabs((was) => [...was, tab]);
    setActiveId(tab.id);
  };

  const closeTab = (id: string) => {
    delete sendersRef.current[id];
    setTabs((was) => {
      const remaining = was.filter((tab) => tab.id !== id);
      if (id === activeId) {
        const closedIndex = was.findIndex((tab) => tab.id === id);
        const fallback = remaining[closedIndex] ?? remaining[closedIndex - 1] ?? remaining[0];
        setActiveId(fallback?.id ?? '');
      }
      return remaining;
    });
  };

  const sendToActive = (command: string) => {
    sendersRef.current[activeId]?.(command);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1 border-b border-border pb-2">
        {tabs.map((tab) => (
          <span key={tab.id} className="inline-flex items-center">
            <button
              type="button"
              onClick={() => setActiveId(tab.id)}
              aria-pressed={tab.id === activeId}
              className={`inline-flex items-center gap-1.5 rounded-t-md px-3 py-1.5 text-sm transition-colors duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                tab.id === activeId
                  ? 'bg-surface text-ink'
                  : 'text-ink-muted hover:bg-subtle hover:text-ink'
              }`}
            >
              <TerminalIcon width={14} height={14} aria-hidden />
              {tab.label}
            </button>
            <button
              type="button"
              onClick={() => closeTab(tab.id)}
              aria-label={`Close ${tab.label}`}
              className="rounded-md p-1 text-ink-muted transition-colors duration-fast ease-standard hover:bg-subtle hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              <X width={13} height={13} aria-hidden />
            </button>
          </span>
        ))}
        <Button size="sm" variant="ghost" onClick={addTab} aria-label="Open another shell tab">
          <Plus width={15} height={15} aria-hidden />
        </Button>
        <span className="ml-auto">
          <SnippetPicker onPick={sendToActive} disabled={tabs.length === 0} />
        </span>
      </div>

      {tabs.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <Button size="sm" variant="secondary" onClick={addTab}>
            Open a shell
          </Button>
        </div>
      ) : (
        tabs.map((tab) => (
          <ShellTabPanel
            key={tab.id}
            active={tab.id === activeId}
            urlFor={urlFor}
            scopeLabel={scopeLabel}
            scopeDetail={scopeDetail}
            unavailableReason={unavailableReason}
            onSessionReady={(send) => {
              sendersRef.current[tab.id] = send;
            }}
          />
        ))
      )}
    </div>
  );
}

/** One tab's session and its chrome. Kept mounted while inactive so its socket stays alive; only hidden. */
function ShellTabPanel({
  active,
  urlFor,
  scopeLabel,
  scopeDetail,
  unavailableReason,
  onSessionReady,
}: {
  active: boolean;
  onSessionReady: (send: (data: string) => void) => void;
} & Omit<ShellTabsProps, 'unavailableReason'> & { unavailableReason?: string }) {
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
