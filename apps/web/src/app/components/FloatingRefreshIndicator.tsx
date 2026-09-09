import { Text } from '@slideops/design-system';
import { Loader2 } from '@slideops/icons';
import { useEffect, useRef, useState } from 'react';

/*
 * The refresh indicator for a page that polls.
 *
 * The inline Refreshing badge is right for a screen that refetches when an
 * Operator asks it to. It is wrong for one that refetches every five seconds on
 * its own: the badge takes part in layout, so it appeared and disappeared
 * twelve times a minute and the whole page grew and shrank by its height each
 * time, which reads as the page reloading under you while you are trying to
 * read it.
 *
 * Two things fix that. It is taken out of the flow entirely, so nothing below
 * it can move, and it is shown on a slow cadence rather than on every fetch: a
 * poll every few seconds does not need to be announced every few seconds. The
 * point of the indicator is to say "this page is live", which one appearance a
 * half minute says just as well as twelve.
 *
 * It also gets out of the way while an Operator is scrolling, because a fixed
 * badge over content somebody is reading is the one thing worse than a badge
 * that moves the content.
 */

/** How long it stays up once it appears. Long enough to read, and no longer. */
const VISIBLE_MS = 5_000;

/** How long it stays away between appearances. */
const HIDDEN_MS = 30_000;

/** How long after the last scroll before it may return. */
const SCROLL_QUIET_MS = 600;

export function FloatingRefreshIndicator({
  show,
  label = 'Refreshing',
}: {
  /** Whether a refresh is actually in flight. Nothing is shown when it is not. */
  show: boolean;
  label?: string;
}) {
  const [visible, setVisible] = useState(false);
  const [scrolling, setScrolling] = useState(false);
  const timer = useRef<number | null>(null);

  // The show/hide cycle runs on its own, independent of how often the page
  // actually refetches, so a fast poll cannot turn into a fast flicker.
  useEffect(() => {
    let cancelled = false;

    const step = (nextVisible: boolean) => {
      if (cancelled) {
        return;
      }
      setVisible(nextVisible);
      timer.current = window.setTimeout(
        () => step(!nextVisible),
        nextVisible ? VISIBLE_MS : HIDDEN_MS,
      );
    };

    // Starts hidden: a page that has just loaded is already telling the
    // Operator it is working, and an indicator on top of that says nothing.
    timer.current = window.setTimeout(() => step(true), HIDDEN_MS);

    return () => {
      cancelled = true;
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
      }
    };
  }, []);

  useEffect(() => {
    let quiet: number | null = null;
    const onScroll = () => {
      setScrolling(true);
      if (quiet !== null) {
        window.clearTimeout(quiet);
      }
      quiet = window.setTimeout(() => setScrolling(false), SCROLL_QUIET_MS);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (quiet !== null) {
        window.clearTimeout(quiet);
      }
    };
  }, []);

  // Rendered even when it is not being shown, so the element that carries the
  // status role does not appear and disappear from the accessibility tree
  // twelve times a minute. It is the opacity that changes, and opacity moves
  // nothing.
  const on = show && visible && !scrolling;

  return (
    <div
      aria-hidden={!on}
      className={`pointer-events-none fixed bottom-6 right-6 z-40 transition-opacity duration-base ease-standard ${
        on ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <span
        role="status"
        className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface px-3 py-1.5 shadow-sm"
      >
        <Loader2 width={13} height={13} className="animate-spin text-ink-muted" aria-hidden />
        <Text variant="caption" tone="secondary">
          {on ? label : ''}
        </Text>
      </span>
    </div>
  );
}
