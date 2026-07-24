import type { Transition, Variants } from 'framer-motion';

/**
 * The shared reveal vocabulary for the marketing surface.
 *
 * Every scroll-driven entrance in the later chunks composes one of these named
 * variants, so the whole page moves with one easing and one rhythm rather than a
 * dozen ad-hoc animations. Durations and easing mirror the design-system motion
 * tokens (`--so-duration-slow`, `--so-ease-entrance`) numerically, because
 * Framer Motion needs literal values and cannot read CSS variables at runtime.
 */

/** The entrance easing, matching `--so-ease-entrance` (a soft, settling curve). */
export const entranceEase: Transition['ease'] = [0.16, 1, 0.3, 1];

/** The base reveal duration in seconds, matching `--so-duration-slow` (420ms). */
export const revealDuration = 0.42;

/** The distance a sliding reveal travels before it settles, in pixels. */
export const revealOffset = 16;

/** The directions a {@link revealVariants} entrance can travel from. */
export type RevealDirection = 'up' | 'down' | 'left' | 'right' | 'none';

/** The visual character of a reveal: a fade, a directional slide, or a scale. */
export type RevealKind = 'fade' | 'slide' | 'scale';

function hiddenOffset(kind: RevealKind, direction: RevealDirection, distance: number) {
  if (kind !== 'slide' || direction === 'none') {
    return { x: 0, y: 0 };
  }
  switch (direction) {
    case 'up':
      return { x: 0, y: distance };
    case 'down':
      return { x: 0, y: -distance };
    case 'left':
      return { x: distance, y: 0 };
    case 'right':
      return { x: -distance, y: 0 };
    default:
      return { x: 0, y: 0 };
  }
}

/**
 * Build the hidden and visible states for a single reveal. Callers pass the kind
 * (fade, slide, or scale), the travel direction for slides, and optional timing
 * so a primitive can stagger or delay without redefining the motion itself.
 */
export function revealVariants(options: {
  kind?: RevealKind;
  direction?: RevealDirection;
  distance?: number;
  duration?: number;
  delay?: number;
} = {}): Variants {
  const {
    kind = 'slide',
    direction = 'up',
    distance = revealOffset,
    duration = revealDuration,
    delay = 0,
  } = options;
  const offset = hiddenOffset(kind, direction, distance);

  return {
    hidden: {
      opacity: 0,
      x: offset.x,
      y: offset.y,
      scale: kind === 'scale' ? 0.96 : 1,
    },
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
      scale: 1,
      transition: { duration, ease: entranceEase, delay },
    },
  };
}

/**
 * The container/child pair a word-by-word reveal uses: the container stays put
 * and only orchestrates timing, while each word runs {@link revealVariants}. The
 * stagger is what makes a heading assemble one word at a time.
 */
export function wordRevealVariants(options: { stagger?: number; delay?: number } = {}): {
  container: Variants;
  word: Variants;
} {
  const { stagger = 0.08, delay = 0 } = options;
  return {
    container: {
      hidden: {},
      visible: {
        transition: { staggerChildren: stagger, delayChildren: delay },
      },
    },
    word: revealVariants({ kind: 'slide', direction: 'up', distance: revealOffset * 0.75 }),
  };
}
