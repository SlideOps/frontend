import { Text } from '@slideops/design-system';
import { Loader2 } from '@slideops/icons';

/**
 * A quiet indicator that a refresh is in flight, for a screen that keeps showing
 * its existing content while it refetches.
 *
 * It is deliberately small and inline. Replacing a working panel with a spinner on
 * every refresh is what made the app feel like it reloaded the page; the content
 * should stay put and this should be the only thing that changes.
 */
export function Refreshing({ label = 'Refreshing', show }: { label?: string; show: boolean }) {
  if (!show) {
    return null;
  }
  return (
    <span role="status" className="inline-flex items-center gap-1.5 text-ink-muted">
      <Loader2 width={13} height={13} className="animate-spin" aria-hidden />
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
    </span>
  );
}
