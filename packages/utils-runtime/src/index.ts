/** True when running in a browser with a DOM available. */
export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/** Join class name fragments, dropping anything falsy. */
export function classNames(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/**
 * Format an instant as a short, human relative phrase such as "3 minutes ago".
 * Used for recent Operation timestamps.
 */
export function formatRelativeTime(value: Date | string | number, now: Date = new Date()): string {
  const then = value instanceof Date ? value : new Date(value);
  const seconds = Math.round((now.getTime() - then.getTime()) / 1000);
  if (seconds < 45) {
    return 'just now';
  }
  const units: Array<[label: string, secondsPer: number]> = [
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];
  for (const [label, secondsPer] of units) {
    const amount = Math.floor(seconds / secondsPer);
    if (amount >= 1) {
      return `${amount} ${label}${amount === 1 ? '' : 's'} ago`;
    }
  }
  return 'just now';
}

/** Clamp a number into an inclusive range. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
