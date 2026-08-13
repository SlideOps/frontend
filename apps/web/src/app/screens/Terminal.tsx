import { nodeShellUrl, serviceShellUrl } from '@slideops/api-client';
import { Terminal as TerminalIcon } from '@slideops/icons';
import { PageHeader } from '@slideops/ui';
import { useRef, useState } from 'react';
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

  return (
    <OperatorShell active="terminal">
      <PageHeader
        title="Terminal"
        description="Open a shell on any server or Service, from anywhere in your Workspace."
        guidanceKey="terminal.overview"
      />

      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <TabStrip
          tabs={tabs}
          activeId={activeId}
          onSelect={setActiveId}
          onClose={closeTab}
          trailing={
            <>
              <TargetPicker onPick={openTarget} />
              {tabs.length > 0 ? (
                <span className="ml-auto">
                  <SnippetPicker onPick={sendToActive} disabled={tabs.length === 0} />
                </span>
              ) : null}
            </>
          }
        />

        {tabs.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center">
            <TerminalIcon width={28} height={28} className="text-ink-muted" aria-hidden />
            <p className="text-sm text-ink-muted">
              Pick a server or Service above to open a shell on it.
            </p>
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
    </OperatorShell>
  );
}
