import type { ComponentType, ReactNode, SVGProps } from 'react';
import { cn } from '../lib/cn';
import { Text } from './Text';

// Matches both the Lucide re-exports (size?: string | number) and hand
// authored brand icons (size?: number): every consumer here renders with
// width/height, not size, so the shared type only needs the SVG props.
type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

/*
 * A labelled number. NodeCapacity and NodeHealth each defined their own copy
 * of this same shape (an icon, a label, a value, an optional bar underneath)
 * with different names and no relationship to each other; the Workspace home
 * and the admin Overview each had a third and fourth version besides.
 *
 * Two dividing conventions live here, not one, because they solve different
 * layouts correctly rather than one solving both badly. A single row that
 * never wraps (Workspace's headline strip) separates with hairlines on the
 * row's own divide-x, which is the quieter choice and the one this file
 * defaults to. A grid that can wrap to a new row (Capacity, Health, the admin
 * Overview) cannot use that trick: a shared CSS divide rule cannot tell a
 * cell that starts a new row from one that continues it, so it draws a stray
 * border down the middle of the wrap. `bordered` opts a tile into its own
 * border instead, which is the one thing that stays correct regardless of
 * how the grid wraps.
 */

export type StatTileTone = 'primary' | 'success' | 'warning' | 'danger';

const TONE_CLASS: Record<StatTileTone, string> = {
  primary: 'text-ink',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
};

export interface StatTileProps {
  /** Sized 16x16 by this component. Typed structurally so design-system takes on no icon package dependency. */
  icon?: IconComponent;
  label: ReactNode;
  value: ReactNode;
  /** Colors the value only. Defaults to plain ink. */
  tone?: StatTileTone;
  /** Sits beside the label: a Guidance trigger, a badge. */
  adornment?: ReactNode;
  /** Extra content under the value: a mini progress bar, a trailing caption. */
  footer?: ReactNode;
  /** Its own border, for a tile in a grid that can wrap to a new row. See the file comment. */
  bordered?: boolean;
  className?: string;
}

export function StatTile({
  icon: Icon,
  label,
  value,
  tone = 'primary',
  adornment,
  footer,
  bordered = false,
  className,
}: StatTileProps) {
  return (
    <div
      className={cn(
        'min-w-0',
        bordered ? 'rounded-md border border-border bg-surface p-3' : 'flex-1 px-5 py-4',
        className,
      )}
    >
      <div className="flex items-center gap-1.5 text-ink-muted">
        {Icon ? <Icon width={16} height={16} aria-hidden /> : null}
        <Text variant="caption" tone="secondary">
          {label}
        </Text>
        {adornment}
      </div>
      <Text
        variant="h4"
        className={cn('mt-1.5 block truncate text-xl font-semibold tabular-nums', TONE_CLASS[tone])}
      >
        {value}
      </Text>
      {footer ? <div className="mt-2">{footer}</div> : null}
    </div>
  );
}
