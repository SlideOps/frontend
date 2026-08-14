import { nodeShellUrl, serviceShellUrl } from '@slideops/api-client';
import { Button, Text } from '@slideops/design-system';
import { ArrowUpRight, Maximize2, Minimize2, Terminal as TerminalIcon } from '@slideops/icons';
import { PageHeader } from '@slideops/ui';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ShellTabPanel } from '../components/shell/ShellTabPanel';
import { SnippetPicker } from '../components/shell/SnippetPicker';
import { TabStrip } from '../components/shell/TabStrip';
import { TargetPicker, type PickedTarget } from '../components/shell/TargetPicker';
import { OperatorShell } from '../components/OperatorShell';

/*
 * One terminal home for the whole Workspace: pick any server or Service,
 * open a shell on it, and keep working across several without leaving the
 * page or hunting down each resource's own detail page first. Every tab here
 * dials the same shell websocket a Node's or Service's own page already
 * offers -- this is a different front door onto the same connections, not a
 * new protocol.
 *
 * Expanding fills the browser window the same way a single embedded
 * ShellTerminal does. "Open in a new tab" is the same page again with
 * ?expanded=1, since there is no one Node or Service to hand a standalone
 * route to here -- the point of this page is picking between many.
 */

interface OpenTab {
  id: string;
  label: string;
  urlFor: (cols: number, rows: number) => string;
  scopeLabel: string;
  scopeDetail: string;
  unavailableReason?: string;
}

function tabFor(target: PickedTarget): OpenTab {
  const id = crypto.randomUUID();
  if (target.kind === 'node') {
    return {
      id,
      label: target.node.name,
      urlFor: (cols, rows) => nodeShellUrl(target.node.id, cols, rows),
      scopeLabel: target.node.name,
      scopeDetail: 'A shell on the server itself. Opening it is recorded in the audit trail.',
    };
  }
  const service = target.service;
  return {
    id,
    label: service.name,
    urlFor: (cols, rows) => serviceShellUrl(service.id, cols, rows),
    scopeLabel: service.name,
    scopeDetail:
      service.runtime === 'systemd'
        ? 'A shell on the server in this Service’s own directory. Opening it is recorded in the audit trail.'
        : 'A shell inside this Service’s own container. Opening it is recorded in the audit trail.',
    unavailableReason:
      service.status === 'running'
        ? undefined
        : `This Service is ${service.status}, so there is nothing running to open a shell in.`,
  };
}

export function Terminal() {
  const [tabs, setTabs] = useState<OpenTab[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const sendersRef = useRef<Record<string, (data: string) => void>>({});
  const [searchParams] = useSearchParams();
  // A new tab opened via "Open in a new tab" starts expanded, so it reads as
  // the fullscreen view it was asked for rather than the ordinary page.
  const [expanded, setExpanded] = useState(() => searchParams.get('expanded') === '1');

  // Escape leaves the expanded view, matching the single embedded terminal.
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

  const openTarget = (target: PickedTarget) => {
    const tab = tabFor(target);
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

  const body = (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <TabStrip
        tabs={tabs}
        activeId={activeId}
        onSelect={setActiveId}
        onClose={closeTab}
        trailing={
          <>
            <TargetPicker onPick={openTarget} />
            <span className="ml-auto flex items-center gap-1">
              {tabs.length > 0 ? <SnippetPicker onPick={sendToActive} disabled={tabs.length === 0} /> : null}
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
              {expanded ? null : (
                <a
                  href="/app/terminal?expanded=1"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open in a new tab, full screen"
                  aria-label="Open in a new tab, full screen"
                  className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-sm text-ink-muted transition-colors duration-fast ease-standard hover:bg-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                >
                  <ArrowUpRight width={15} height={15} aria-hidden />
                </a>
              )}
            </span>
          </>
        }
      />

      {tabs.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center">
          <TerminalIcon width={28} height={28} className="text-ink-muted" aria-hidden />
          <p className="text-sm text-ink-muted">Pick a server or Service above to open a shell on it.</p>
        </div>
      ) : (
        tabs.map((tab) => (
          <ShellTabPanel
            key={tab.id}
            active={tab.id === activeId}
            urlFor={tab.urlFor}
            scopeLabel={tab.scopeLabel}
            scopeDetail={tab.scopeDetail}
            unavailableReason={tab.unavailableReason}
            onSessionReady={(send) => {
              sendersRef.current[tab.id] = send;
            }}
          />
        ))
      )}
    </div>
  );

  if (expanded) {
    return (
      <OperatorShell active="terminal">
        {/* Fixed rather than a modal: filling the window is the entire point,
            and there is nothing to dismiss by clicking away. */}
        <div className="fixed inset-0 z-50 flex flex-col gap-3 bg-app p-4">
          <div className="flex items-center gap-2">
            <TerminalIcon width={16} height={16} className="text-brand" aria-hidden />
            <Text variant="body-sm" className="font-medium">
              Terminal
            </Text>
          </div>
          {body}
        </div>
      </OperatorShell>
    );
  }

  return (
    <OperatorShell active="terminal">
      <PageHeader
        title="Terminal"
        description="Open a shell on any server or Service, from anywhere in your Workspace."
        guidanceKey="terminal.overview"
      />
      {body}
    </OperatorShell>
  );
}
