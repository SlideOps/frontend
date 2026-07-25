import { ChevronDown } from '@slideops/icons';
import { useCallback, useId, useMemo, useState, type ReactNode } from 'react';

export interface CollapsibleProps {
  /** The heading shown on the disclosure button. */
  title: ReactNode;
  /** Optional right-aligned summary or badge, always visible even when collapsed. */
  summary?: ReactNode;
  /** Optional leading icon rendered before the title. */
  icon?: ReactNode;
  /** Open on first render when used uncontrolled. Ignored when `open` is supplied. */
  defaultOpen?: boolean;
  /** Controlled open state. Pass together with `onOpenChange` to let a parent drive it. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
  className?: string;
}

/**
 * An accessible disclosure section. It mirrors the FAQ accordion: a header
 * button carries aria-expanded and aria-controls, the panel is a labelled
 * region that is truly hidden when closed, and a chevron rotates with state.
 * Works uncontrolled (defaultOpen) or controlled (open + onOpenChange) so a
 * parent can drive a whole group with one Collapse all / Expand all control.
 */
export function Collapsible({
  title,
  summary,
  icon,
  defaultOpen = false,
  open,
  onOpenChange,
  children,
  className,
}: CollapsibleProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;

  const reactId = useId();
  const panelId = `collapsible-panel-${reactId}`;
  const buttonId = `collapsible-button-${reactId}`;

  const toggle = useCallback(() => {
    const next = !isOpen;
    if (!isControlled) {
      setInternalOpen(next);
    }
    onOpenChange?.(next);
  }, [isControlled, isOpen, onOpenChange]);

  return (
    <div
      className={[
        'rounded-lg border border-border bg-surface transition-colors duration-fast ease-standard',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <h3>
        <button
          type="button"
          id={buttonId}
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={toggle}
          className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors duration-fast ease-standard hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          {icon ? (
            <span className="shrink-0 text-brand" aria-hidden>
              {icon}
            </span>
          ) : null}
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{title}</span>
          {summary ? (
            <span className="ml-auto shrink-0 text-xs text-ink-muted">{summary}</span>
          ) : null}
          <ChevronDown
            width={16}
            height={16}
            aria-hidden
            className={[
              'shrink-0 text-ink-muted transition-transform duration-fast ease-standard',
              isOpen ? 'rotate-180' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          />
        </button>
      </h3>
      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        hidden={!isOpen}
        className="border-t border-border px-4 py-4"
      >
        {children}
      </div>
    </div>
  );
}

export interface CollapsibleGroupItem {
  /** A stable identifier for the section. */
  id: string;
  /** Whether the section starts open. */
  defaultOpen?: boolean;
}

export interface CollapsibleGroup {
  isOpen: (id: string) => boolean;
  setOpen: (id: string, open: boolean) => void;
  expandAll: () => void;
  collapseAll: () => void;
  /** True when every known section is open. */
  allOpen: boolean;
  /** True when every known section is closed. */
  allClosed: boolean;
}

/**
 * Drives a set of Collapsible sections from one place so a parent can offer a
 * single Collapse all / Expand all control. Pass each section's `open` and
 * `onOpenChange` from this group; the ids define which sections it governs.
 */
export function useCollapsibleGroup(items: CollapsibleGroupItem[]): CollapsibleGroup {
  const initial = useMemo(() => {
    const state: Record<string, boolean> = {};
    for (const item of items) {
      state[item.id] = item.defaultOpen ?? false;
    }
    return state;
  }, [items]);

  const [state, setState] = useState<Record<string, boolean>>(initial);

  const isOpen = useCallback((id: string) => state[id] ?? false, [state]);

  const setOpen = useCallback((id: string, open: boolean) => {
    setState((prev) => ({ ...prev, [id]: open }));
  }, []);

  const expandAll = useCallback(() => {
    setState((prev) => {
      const next: Record<string, boolean> = {};
      for (const key of Object.keys(prev)) {
        next[key] = true;
      }
      return next;
    });
  }, []);

  const collapseAll = useCallback(() => {
    setState((prev) => {
      const next: Record<string, boolean> = {};
      for (const key of Object.keys(prev)) {
        next[key] = false;
      }
      return next;
    });
  }, []);

  const values = Object.values(state);
  const allOpen = values.length > 0 && values.every(Boolean);
  const allClosed = values.every((value) => !value);

  return { isOpen, setOpen, expandAll, collapseAll, allOpen, allClosed };
}
