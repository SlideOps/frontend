import { cn, useTheme } from '@slideops/design-system';
import { Logo, Moon, Sun, type LucideIcon } from '@slideops/icons';
import { Fragment, type ReactNode } from 'react';

export interface NavItem {
  key: string;
  label: string;
  icon: LucideIcon;
  active?: boolean;
  onSelect?: () => void;
  /**
   * The section this entry belongs to, shown as a heading above the first entry
   * carrying it. A flat list of a dozen equally weighted destinations makes an
   * Operator read all of them to find one; grouping says what each part of the
   * product is for before they have to guess.
   *
   * Entries are rendered in the order given, so items sharing a group must be
   * adjacent. An entry with no group renders with no heading, which is what the
   * first, most used entry wants.
   */
  group?: string;
}

export interface AppShellProps {
  /** Navigation entries. Rendered as a side rail on wide screens and a bottom bar on phones. */
  nav: NavItem[];
  /** Product surface name shown by the logo, for example Operator or Admin. */
  surface: string;
  children: ReactNode;
  /** Optional slot at the top right of the shell, for account or notifications. */
  actions?: ReactNode;
  /** Denser spacing, used by the admin surface. */
  dense?: boolean;
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
      {isDark ? <Sun width={18} height={18} aria-hidden /> : <Moon width={18} height={18} aria-hidden />}
    </button>
  );
}

function NavButton({ item, dense }: { item: NavItem; dense: boolean }) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={item.onSelect}
      aria-current={item.active ? 'page' : undefined}
      className={cn(
        'group flex items-center gap-3 rounded-md font-medium transition-colors duration-fast ease-standard',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
        dense ? 'px-3 py-2 text-sm' : 'px-3 py-2.5',
        item.active ? 'bg-subtle text-brand' : 'text-ink-muted hover:bg-subtle hover:text-ink',
      )}
    >
      <Icon width={20} height={20} aria-hidden />
      <span>{item.label}</span>
    </button>
  );
}

/**
 * The shared application frame. On wide screens it shows a side navigation rail
 * and a scrolling content column. On phones it moves navigation to a bottom bar
 * with large touch targets, respecting safe-area insets. Both surfaces share it
 * so the operator and the admin never drift.
 */
export function AppShell({ nav, surface, children, actions, dense = false }: AppShellProps) {
  return (
    <div className="flex min-h-screen bg-app text-ink">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-surface px-3 py-4 md:flex">
        <div className="flex items-center gap-2 px-2 pb-6">
          <Logo size={26} />
          <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">{surface}</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1" aria-label={`${surface} navigation`}>
          {nav.map((item, index) => {
            // A heading appears the first time a group is seen. Comparing against
            // the previous entry keeps the grouping in the caller's ordering rather
            // than reordering their navigation behind their back.
            const heading = item.group && item.group !== nav[index - 1]?.group ? item.group : null;
            return (
              <Fragment key={item.key}>
                {heading ? (
                  <div className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                    {heading}
                  </div>
                ) : null}
                <NavButton item={item} dense={dense} />
              </Fragment>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-surface/90 px-4 py-3 backdrop-blur md:px-6">
          <div className="flex items-center gap-2 md:hidden">
            <Logo size={22} markOnly />
            <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">{surface}</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {actions}
            <ThemeToggle />
          </div>
        </header>

        <main className={cn('min-w-0 flex-1', dense ? 'p-4 md:p-6' : 'p-4 md:p-8', 'pb-24 md:pb-8')}>
          {children}
        </main>
      </div>

      <nav
        aria-label={`${surface} navigation`}
        // Scrolls rather than dividing the screen by however many destinations
        // exist. Squeezing a dozen into a phone's width left every label truncated
        // to a few characters, which is not a navigation bar, it is a puzzle.
        className="fixed inset-x-0 bottom-0 z-40 flex items-stretch gap-1 overflow-x-auto border-t border-border bg-surface px-1 pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {nav.map((item) => {
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
