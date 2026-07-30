import { CircleHelp } from '@slideops/icons';
import { Popover } from './Popover';
import { Tooltip, type Placement } from './Tooltip';
import { useGuidance } from './registry';

export interface GuidanceProps {
  /** The stable content key registered with the GuidanceProvider. */
  for: string;
  placement?: Placement;
  /** Size of the help trigger in pixels. */
  size?: number;
}

const triggerClass =
  'inline-flex h-5 w-5 items-center justify-center rounded-pill text-ink-muted transition-colors duration-fast ease-standard hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';

/**
 * A guidance trigger. It renders a small help control next to any element and
 * shows the registered explanation for the given key. Short summaries appear in
 * a tooltip; when a longer detail exists the control opens an accessible
 * popover instead. This is the always-present teaching layer of the product.
 */
export function Guidance({ for: key, placement = 'top', size = 16 }: GuidanceProps) {
  const entry = useGuidance(key);
  if (!entry) {
    return null;
  }

  if (entry.detail) {
    return (
      <Popover
        label={entry.label}
        placement={placement === 'top' ? 'bottom' : placement}
        trigger={(props) => (
          <button
            type="button"
            className={triggerClass}
            aria-label={`About ${entry.label}`}
            {...props}
          >
            <CircleHelp width={size} height={size} aria-hidden />
          </button>
        )}
      >
        <p className="font-medium text-ink">{entry.label}</p>
        <div className="mt-1 text-ink-muted">{entry.detail}</div>
      </Popover>
    );
  }

  return (
    <Tooltip content={entry.summary} placement={placement}>
      <button
        type="button"
        className={triggerClass}
        aria-label={`About ${entry.label}: ${entry.label}`}
      >
        <CircleHelp width={size} height={size} aria-hidden />
      </button>
    </Tooltip>
  );
}
