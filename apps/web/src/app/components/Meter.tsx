import { Text } from '@slideops/design-system';

/*
 * A simple usage meter. It reads used against a limit and paints a bar that
 * turns from success to warning to danger as the reading approaches the ceiling,
 * so a limit that is close reads at a glance. Every color is a semantic design
 * token, so it belongs to both themes, and the bar exposes a progressbar role
 * for assistive technology. Motion on the fill respects reduced motion through
 * the shared transition tokens.
 */

/** The thresholds where a meter shifts tone, as a fraction of the limit. */
const WARNING_AT = 0.75;
const DANGER_AT = 0.9;

function fillTone(ratio: number): string {
  if (ratio >= DANGER_AT) {
    return 'bg-danger';
  }
  if (ratio >= WARNING_AT) {
    return 'bg-warning';
  }
  return 'bg-success';
}

export interface MeterProps {
  label: string;
  /** The amount in use. */
  used: number;
  /** The ceiling this reading is measured against. */
  limit: number;
  /** A ready-formatted reading, such as "128 / 256 MB". Falls back to used of limit. */
  valueText?: string;
  /** A small note under the reading, such as the fraction remaining. */
  hint?: string;
  /** Optional adornment next to the label, such as a guidance trigger. */
  labelAdornment?: React.ReactNode;
}

/** One labelled quota reading with a tone-shifting fill. */
export function Meter({ label, used, limit, valueText, hint, labelAdornment }: MeterProps) {
  const ratio = limit > 0 ? used / limit : 0;
  const percent = Math.min(100, Math.max(0, ratio * 100));
  const reading = valueText ?? `${used} / ${limit}`;

  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Text variant="caption" tone="secondary">
            {label}
          </Text>
          {labelAdornment}
        </div>
        <span className="text-sm font-medium text-ink">{reading}</span>
      </div>
      <div
        className="mt-2 h-1.5 w-full overflow-hidden rounded-pill bg-subtle"
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}: ${reading}`}
      >
        <div
          className={`h-full rounded-pill transition-[width] duration-base ease-standard ${fillTone(ratio)}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      {hint ? (
        <Text variant="caption" tone="secondary" className="mt-1.5 block">
          {hint}
        </Text>
      ) : null}
    </div>
  );
}
