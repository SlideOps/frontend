/*
 * The Operator-facing language for a Capability that has already been carried out
 * on a Node. It turns a raw completion into a clear label, a quieter re-run verb,
 * and a short "how long ago" phrase, so a done Capability reads as done and an
 * accidental repeat is discouraged rather than blocked.
 */

/**
 * The word for a completed Capability, chosen from the outcome in its key: an
 * install reads "Installed", an enable "Enabled", a configure "Configured", a
 * secure "Secured", and anything else the plain "Done". A single "Done" always
 * reads correctly, so an unrecognized key is never wrong.
 */
export function completionLabel(capabilityKey: string): string {
  const key = capabilityKey.toLowerCase();
  if (key.startsWith('install')) {
    return 'Installed';
  }
  if (key.startsWith('enable')) {
    return 'Enabled';
  }
  if (key.startsWith('configure')) {
    return 'Configured';
  }
  if (key.startsWith('secure')) {
    return 'Secured';
  }
  return 'Done';
}

/**
 * The quieter action verb for a Capability already carried out. It re-runs the
 * same outcome, so it reads as "Re-run" rather than a fresh first-time action.
 */
export const RE_RUN_LABEL = 'Re-run';

/**
 * A short relative phrase for when a Capability was last completed, such as
 * "3 minutes ago". A value that does not parse returns an empty string, so a
 * malformed timestamp never renders a broken hint.
 */
export function completedAgo(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const millis = then.getTime();
  if (Number.isNaN(millis)) {
    return '';
  }
  const seconds = Math.round((now.getTime() - millis) / 1000);
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

/** The hint shown beside a re-run action, for example "Already done just now". */
export function completedHint(capabilityKey: string, iso: string, now: Date = new Date()): string {
  const label = completionLabel(capabilityKey).toLowerCase();
  const ago = completedAgo(iso, now);
  const verb = label === 'done' ? 'done' : label;
  return ago ? `Already ${verb} ${ago}` : `Already ${verb}`;
}
