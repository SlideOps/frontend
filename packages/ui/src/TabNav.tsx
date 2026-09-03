import { cn } from '@slideops/design-system';
import type { LucideIcon } from '@slideops/icons';

/*
 * The top tab bar a single resource's own page uses instead of a sidebar: once
 * an Operator is inside one Node, the destinations that matter are the parts of
 * that Node (its overview, its services, its terminal, its settings), not the
 * rest of the product. A left rail listing those beside the global nav would
 * say they are peers of Nodes and Projects, when they are pieces of the one
 * Node already open.
 *
 * Content stays with whoever owns each tab's meaning: this only draws the
 * strip and hands back which key is active, so a page decides for itself
 * whether switching away should keep a tab's work alive or end it, the way an
 * open Terminal session should end rather than sit hidden and still connected.
 */

export interface TabNavTab {
  key: string;
  label: string;
  icon?: LucideIcon;
}

export interface TabNavProps {
  tabs: TabNavTab[];
  active: string;
  onSelect: (key: string) => void;
  className?: string;
}

export function TabNav({ tabs, active, onSelect, className }: TabNavProps) {
  return (
    <div
      role="tablist"
      className={cn(
        '-mb-px flex items-center gap-1 overflow-x-auto border-b border-border',
        className,
      )}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(tab.key)}
            className={cn(
              'group relative flex shrink-0 items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors duration-fast ease-standard',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-0',
              isActive ? 'text-ink' : 'text-ink-muted hover:text-ink',
            )}
          >
            {Icon ? <Icon width={15} height={15} aria-hidden /> : null}
            {tab.label}
            <span
              aria-hidden
              className={cn(
                'absolute inset-x-0 -bottom-px h-[2px] rounded-full transition-colors duration-fast ease-standard',
                isActive ? 'bg-ink' : 'bg-transparent group-hover:bg-border',
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
