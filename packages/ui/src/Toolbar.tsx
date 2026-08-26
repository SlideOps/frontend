import { cn } from '@slideops/design-system';
import { Search, X } from '@slideops/icons';
import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

/*
 * One search and filter placement, reused by every visual manager rather than
 * each one inventing its own row of controls.
 *
 * Every capability's management surface eventually wants the same things above
 * its content: a way to search, a place for a filter chip or two, and a primary
 * action on the right. Left to each screen that becomes three different layouts
 * with three different amounts of padding, which is the kind of inconsistency an
 * Operator feels before they can say why. Toolbar is the one row; SearchBar is
 * the one search control that goes inside it.
 */

export interface ToolbarProps {
  /** The search control, filter chips, anything that narrows what is shown. */
  children?: ReactNode;
  /** Sits at the far end: an Export button, a Refresh, the thing this toolbar is for. */
  actions?: ReactNode;
  className?: string;
}

export function Toolbar({ children, actions, className }: ToolbarProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2.5',
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{children}</div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export interface SearchBarProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  /** Announces what is being searched, for a screen reader with no visible label. */
  label?: string;
}

/**
 * The one search box every visual manager reads from. Matches a spreadsheet's
 * expectation exactly: type something, everything visible narrows to it, clear
 * it to see everything again. The clear control only appears once there is
 * something to clear, so an empty search bar is not cluttered with a button
 * that does nothing.
 */
export const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(function SearchBar(
  { value, onChange, label = 'Search', placeholder = 'Search...', className, ...rest },
  ref,
) {
  return (
    <div className={cn('relative min-w-[12rem] flex-1', className)}>
      <Search
        width={15}
        height={15}
        aria-hidden
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted"
      />
      <input
        ref={ref}
        type="search"
        aria-label={label}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          'h-9 w-full rounded-md border border-border bg-surface pl-8 text-sm text-ink placeholder:text-ink-muted',
          value ? 'pr-8' : 'pr-3',
          'transition-colors duration-fast ease-standard',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
        )}
        {...rest}
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center justify-center rounded-pill p-0.5 text-ink-muted hover:bg-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <X width={14} height={14} aria-hidden />
        </button>
      ) : null}
    </div>
  );
});
