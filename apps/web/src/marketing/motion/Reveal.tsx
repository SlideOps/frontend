import { motion, type HTMLMotionProps } from 'framer-motion';
import type { ElementType, ReactNode } from 'react';
import { useReducedMotion } from './useReducedMotion';
import { revealVariants, type RevealDirection, type RevealKind } from './variants';

interface RevealProps extends Omit<HTMLMotionProps<'div'>, 'variants' | 'initial' | 'animate'> {
  /** What the entrance looks like: a fade, a directional slide, or a scale. */
  kind?: RevealKind;
  /** For slides, the direction the content travels in from. Defaults to `up`. */
  direction?: RevealDirection;
  /** Travel distance for slides, in pixels. */
  distance?: number;
  /** Reveal duration, in seconds. */
  duration?: number;
  /** A delay before the reveal begins, in seconds, for hand-tuned sequencing. */
  delay?: number;
  /**
   * How far the element must enter the viewport before it reveals, as a CSS
   * margin passed to the underlying IntersectionObserver. A negative bottom
   * margin (the default) waits until the element is comfortably on screen.
   */
  margin?: string;
  /** Render as a different element (for example `section` or `li`). */
  as?: ElementType;
  children?: ReactNode;
}

/**
 * Reveal a block once, as it scrolls into view.
 *
 * This is the workhorse entrance for the marketing surface: wrap a heading, a
 * card, or a whole row and it fades, slides, or scales into place the first time
 * it enters the viewport, then stays put. It is built on `whileInView` with
 * `once: true`, so nothing re-animates on the way back up.
 *
 * Under a reduce-motion preference it renders the finished state immediately
 * with no transition, so the layout is identical and complete, only still.
 */
export function Reveal({
  kind = 'slide',
  direction = 'up',
  distance,
  duration,
  delay,
  margin = '0px 0px -12% 0px',
  as = 'div',
  children,
  ...rest
}: RevealProps) {
  const reduced = useReducedMotion();
  const MotionTag = motion(as as ElementType);

  if (reduced) {
    // Skip the entrance entirely: no offset, no fade, just the resting state.
    return <MotionTag {...rest}>{children}</MotionTag>;
  }

  return (
    <MotionTag
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin }}
      variants={revealVariants({ kind, direction, distance, duration, delay })}
      {...rest}
    >
      {children}
    </MotionTag>
  );
}
