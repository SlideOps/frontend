import { Button } from '@slideops/design-system';
import { Plus } from '@slideops/icons';
import { useRef, useState } from 'react';
import { ShellTabPanel } from './ShellTabPanel';
import { SnippetPicker } from './SnippetPicker';
import { TabStrip } from './TabStrip';

/*
 * Several independent shells on one page, all attached to the same target.
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
      <TabStrip
        tabs={tabs}
        activeId={activeId}
        onSelect={setActiveId}
        onClose={closeTab}
        trailing={
          <>
            <Button size="sm" variant="ghost" onClick={addTab} aria-label="Open another shell tab">
              <Plus width={15} height={15} aria-hidden />
            </Button>
            <span className="ml-auto">
              <SnippetPicker onPick={sendToActive} disabled={tabs.length === 0} />
            </span>
          </>
        }
      />

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
