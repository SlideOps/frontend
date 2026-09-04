import { cn } from '@slideops/design-system';
import { useNavigate } from 'react-router-dom';

/*
 * The two destinations under Billing: the plan and checkout on Overview, and
 * the payment activity center on Transactions. Each is its own route (unlike
 * a single page's own local tabs), so this navigates rather than toggling
 * local state -- the same underline-tab visual language TabNav uses for a
 * single resource's own tabs, applied here across two real pages instead.
 */

const TABS = [
  { key: 'overview', label: 'Overview', path: '/app/billing' },
  { key: 'transactions', label: 'Transactions', path: '/app/billing/transactions' },
] as const;

export function BillingTabs({
  active,
  className,
}: {
  active: 'overview' | 'transactions';
  className?: string;
}) {
  const navigate = useNavigate();
  return (
    <div role="tablist" className={cn('-mb-px flex items-center gap-1 border-b border-border', className)}>
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => navigate(tab.path)}
            className={cn(
              'group relative px-3 py-2.5 text-sm font-medium transition-colors duration-fast ease-standard',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-0',
              isActive ? 'text-ink' : 'text-ink-muted hover:text-ink',
            )}
          >
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
