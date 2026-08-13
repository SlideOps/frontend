import { Terminal as TerminalIcon, X } from '@slideops/icons';
import type { ReactNode } from 'react';

/*
 * The tab-button row shared by every tab strip in the app. It only knows how
 * to select and close a tab; how a new tab gets created differs by caller
 * (ShellTabs adds one instantly, the global Terminal page opens a picker
 * first) so that control is entirely owned by the caller via `trailing`.
 */

export interface StripTab {
  id: string;
  label: string;
}

export interface TabStripProps {
  tabs: StripTab[];
  activeId: string;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  /** The "add a tab" control, and anything else that belongs at the strip's end (a snippet picker). */
  trailing?: ReactNode;
}

export function TabStrip({ tabs, activeId, onSelect, onClose, trailing }: TabStripProps) {
  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-border pb-2">
      {tabs.map((tab) => (
        <span key={tab.id} className="inline-flex items-center">
          <button
            type="button"
            onClick={() => onSelect(tab.id)}
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
            onClick={() => onClose(tab.id)}
            aria-label={`Close ${tab.label}`}
            className="rounded-md p-1 text-ink-muted transition-colors duration-fast ease-standard hover:bg-subtle hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <X width={13} height={13} aria-hidden />
          </button>
        </span>
      ))}
      {trailing}
    </div>
  );
}
