import { cn, useTheme } from '@slideops/design-system';
import { Logo, Moon, PanelLeftClose, PanelLeftOpen, Sun } from '@slideops/icons';
import { Tooltip } from '@slideops/tooltips';
import { type ReactNode } from 'react';
import { SidebarNav, type NavGroup, type NavItem } from './SidebarNav';

export interface AppShellProps {
  /** Product surface name shown by the logo, for example Operator or Admin. */
  surface: string;
  /** Entries above every group: the one or two destinations always worth a click. */
  primary: NavItem[];
  /** The grouped destinations, in the order they should read. */
  groups: NavGroup[];
  /**
   * A block above the navigation answering which context the Operator is
   * working in, not what they want to do. Held apart from the navigation on
   * purpose, so those two questions never look like the same list.
   */
  context?: ReactNode;
  /**
   * Destinations that live in the context block on a wide screen. The phone bar
   * has no context block, so they are folded into it rather than lost.
   */
  contextNav?: NavItem[];
  /** A quiet entry below the navigation, for example leaving the admin area. */
  footer?: NavItem;
  /** Optional slot at the top right of the shell, for account or notifications. */
  actions?: ReactNode;
  /** Denser spacing, used by the admin surface. */
  dense?: boolean;
  children: ReactNode;
  /** Keys of the groups this Operator has closed. */
  collapsedGroups: readonly string[];
  onToggleGroup: (key: string) => void;
  /** Whether the sidebar is reduced to an icon rail. */
  railCollapsed: boolean;
  onToggleRail: () => void;
}

function ThemeToggle() {
  const { resolved, toggle } = useTheme();
  const isDark = resolved === 'dark';
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-muted transition-colors duration-fast ease-standard hover:bg-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
    >
      {isDark ? (
        <Sun width={18} height={18} aria-hidden />
      ) : (
        <Moon width={18} height={18} aria-hidden />
      )}
    </button>
  );
}

/** The control that trades labels for width, and back again. */
function RailToggle({ rail, onToggle }: { rail: boolean; onToggle: () => void }) {
  const label = rail ? 'Expand the sidebar' : 'Collapse the sidebar';
  const Icon = rail ? PanelLeftOpen : PanelLeftClose;
  const button = (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      aria-pressed={rail}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-muted transition-colors duration-fast ease-standard hover:bg-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
    >
      <Icon width={16} height={16} aria-hidden />
    </button>
  );
  if (!rail) {
    return button;
  }
  return (
    <Tooltip content={label} placement="right">
      {button}
    </Tooltip>
  );
}

/**
 * The shared application frame. On wide screens it shows a sidebar that can be
 * reduced to an icon rail, and a scrolling content column. On phones it moves
 * navigation to a bottom bar with large touch targets, respecting safe-area
 * insets. Both surfaces share it so the operator and the admin never drift.
 */
export function AppShell({
  surface,
  primary,
  groups,
  context,
  contextNav = [],
  footer,
  children,
  actions,
  dense = false,
  collapsedGroups,
  onToggleGroup,
  railCollapsed,
  onToggleRail,
}: AppShellProps) {
  const rail = railCollapsed;
  // The phone bar has one row and no hierarchy to show, so the groups are
  // flattened into it. Every destination the sidebar offers is still here.
  const phoneNav: NavItem[] = [
    ...primary,
    ...groups.flatMap((group) => group.items),
    ...contextNav,
    ...(footer ? [footer] : []),
  ];

  return (
    <div className="flex min-h-dvh bg-app text-ink">
      <aside
        className={cn(
          'sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-surface px-2.5 py-3 md:flex',
          'transition-[width] duration-base ease-standard motion-reduce:transition-none',
          rail ? 'w-16' : 'w-60',
        )}
      >
        <div
          className={cn(
            'flex pb-3',
            rail ? 'flex-col items-center gap-2' : 'items-center gap-2 px-1',
          )}
        >
          <Logo size={rail ? 24 : 26} markOnly={rail} />
          {rail ? null : (
            <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">
              {surface}
            </span>
          )}
          <div className={rail ? undefined : 'ml-auto'}>
            <RailToggle rail={rail} onToggle={onToggleRail} />
          </div>
        </div>

        {context ? <div className="mb-2 border-b border-border pb-2">{context}</div> : null}

        <nav className="flex-1 overflow-y-auto" aria-label={`${surface} navigation`}>
          <SidebarNav
            primary={primary}
            groups={groups}
            collapsedGroups={collapsedGroups}
            onToggleGroup={onToggleGroup}
            rail={rail}
          />
        </nav>

        {footer ? (
          <div className="mt-2 border-t border-border pt-2">
            <SidebarNav
              primary={[footer]}
              groups={[]}
              collapsedGroups={collapsedGroups}
              onToggleGroup={onToggleGroup}
              rail={rail}
            />
          </div>
        ) : null}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-surface/90 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur md:px-6 md:pt-3">
          <div className="flex items-center gap-2 md:hidden">
            <Logo size={22} markOnly />
            <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">
              {surface}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {actions}
            <ThemeToggle />
          </div>
        </header>

        <main
          className={cn('min-w-0 flex-1', dense ? 'p-4 md:p-6' : 'p-4 md:p-8', 'pb-24 md:pb-8')}
        >
          {/* Content is capped and centered so a page reads at the width it was
              designed for, rather than a list or a two-column detail layout
              stretching to whatever a wide monitor happens to be. */}
          <div className="mx-auto w-full max-w-screen-2xl">{children}</div>
        </main>
      </div>

      <nav
        aria-label={`${surface} navigation, compact`}
        // Scrolls rather than dividing the screen by however many destinations
        // exist. Squeezing a dozen into a phone's width left every label truncated
        // to a few characters, which is not a navigation bar, it is a puzzle.
        className="fixed inset-x-0 bottom-0 z-40 flex items-stretch gap-1 overflow-x-auto border-t border-border bg-surface px-1 pb-[env(safe-area-inset-bottom)] pl-[max(0.25rem,env(safe-area-inset-left))] pr-[max(0.25rem,env(safe-area-inset-right))] md:hidden"
      >
        {phoneNav.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              onClick={item.onSelect}
              aria-current={item.active ? 'page' : undefined}
              className={cn(
                'flex w-[4.5rem] shrink-0 flex-col items-center gap-1 py-2 text-xs font-medium',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
                item.active ? 'text-brand' : 'text-ink-muted',
              )}
            >
              <Icon width={22} height={22} aria-hidden />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
