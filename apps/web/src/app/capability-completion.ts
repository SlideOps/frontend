import type { Capability, CapabilityState } from '@slideops/api-client';

/*
 * The Operator-facing language for a Capability whose outcome is already in
 * place on a Node. It turns a raw state into a clear label, a quieter re-run
 * verb, and a short "how long ago" phrase, so an outcome already in place reads
 * that way and an accidental repeat is discouraged rather than blocked.
 *
 * The outcome can be in place for two reasons, and the words differ. SlideOps
 * carried it out, and History holds the record; or it was already there when
 * SlideOps looked, because the Operator set the server up before they found
 * SlideOps, used another tool, or worked from a different account. The second is
 * never described as something SlideOps did.
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

/**
 * The hint shown beside a re-run action, for example "Already installed
 * (version 16) 3 minutes ago". The version is omitted when the completing
 * Operation recorded none, which is the case for a Capability with no version
 * selection and for one installed before version selection existed.
 */
export function completedHint(
  capabilityKey: string,
  iso: string,
  version?: string,
  now: Date = new Date(),
): string {
  const label = completionLabel(capabilityKey).toLowerCase();
  const ago = completedAgo(iso, now);
  const verb = label === 'done' ? 'done' : label;
  const versionPart = version ? ` (version ${version})` : '';
  return ago ? `Already ${verb}${versionPart} ${ago}` : `Already ${verb}${versionPart}`;
}

/**
 * Whether a state was read off the server rather than carried out by SlideOps.
 * A detected state has no Operation behind it, so nothing may link to History.
 */
export function isDetected(state: CapabilityState | undefined): boolean {
  return state?.status === 'detected';
}

/**
 * The badge label for a Capability found already in place on the server, for
 * example "Already installed". It never claims SlideOps did the work.
 */
export function detectedLabel(capabilityKey: string): string {
  return `Already ${completionLabel(capabilityKey).toLowerCase()}`;
}

/**
 * The one-line explanation under a detected Capability: the evidence read off
 * the server, and when it was read. It falls back to a plain sentence when a
 * state carries no evidence, so the card is never blank.
 */
export function detectedHint(state: CapabilityState, now: Date = new Date()): string {
  const evidence = state.evidence?.trim() || 'This was already in place when SlideOps looked.';
  const ago = state.detected_at ? completedAgo(state.detected_at, now) : '';
  return ago ? `${evidence} Found ${ago}.` : evidence;
}

/** The action verb for a Capability already in place that SlideOps did not run. */
export const RUN_ANYWAY_LABEL = 'Run it anyway';

/*
 * Dependency ordering and blocking: the same Capability.dependencies the
 * backend's own hard gate reads before planning an Operation, read here so
 * the Capabilities tab shows the identical picture -- what is ready, what is
 * blocked, and why -- rather than a second guess at it. A Capability already
 * satisfied (done or detected; states carries both under one key) never
 * blocks anything downstream of it, and never blocks itself.
 */

/** One unmet prerequisite: its key, and its display name when known. */
export interface MissingDependency {
  key: string;
  title: string;
}

/** Whether a Capability is blocked, and by which unmet prerequisites. */
export function blockedBy(
  capability: Capability,
  capabilitiesByKey: ReadonlyMap<string, Capability>,
  states: Record<string, CapabilityState>,
): MissingDependency[] {
  return (capability.dependencies ?? [])
    .filter((dep) => !states[dep])
    .map((dep) => ({ key: dep, title: capabilitiesByKey.get(dep)?.name ?? dep }));
}

/**
 * Order capabilities so a blocked one never appears ahead of its own unmet
 * prerequisite, without disturbing the catalog's own order otherwise: a
 * Capability with no Dependencies, or whose Dependencies are all already
 * satisfied, keeps its original relative position. depthOf walks the same
 * graph the hard gate would refuse a request over; a satisfied Capability
 * always contributes depth 0, so ordering only actually moves anything while
 * something real is genuinely blocked.
 */
export function orderByDependencies(
  capabilities: readonly Capability[],
  states: Record<string, CapabilityState>,
): Capability[] {
  const byKey = new Map(capabilities.map((c) => [c.key, c]));
  const depthCache = new Map<string, number>();

  const depthOf = (key: string, seen: Set<string>): number => {
    const cached = depthCache.get(key);
    if (cached !== undefined) {
      return cached;
    }
    if (seen.has(key) || states[key]) {
      return 0;
    }
    const capability = byKey.get(key);
    if (!capability) {
      return 0;
    }
    seen.add(key);
    let max = 0;
    for (const dep of capability.dependencies ?? []) {
      // A satisfied dependency blocks nothing, so it contributes no depth to
      // what depends on it -- only an unmet one does, and only then does its
      // own depth (plus this one step) count.
      if (states[dep]) {
        continue;
      }
      max = Math.max(max, depthOf(dep, seen) + 1);
    }
    depthCache.set(key, max);
    return max;
  };

  return capabilities
    .map((capability, index) => ({ capability, index, depth: depthOf(capability.key, new Set()) }))
    .sort((a, b) => (a.depth !== b.depth ? a.depth - b.depth : a.index - b.index))
    .map((entry) => entry.capability);
}
