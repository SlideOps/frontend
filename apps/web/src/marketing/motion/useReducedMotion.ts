import { useReducedMotion as useFramerReducedMotion } from 'framer-motion';

/**
 * The single reduced-motion signal for the whole marketing surface.
 *
 * Framer Motion's own hook reports `true`, `false`, or `null` (unknown, before
 * the media query has resolved). Every animated primitive in the marketing
 * motion system asks this wrapper instead, so the degrade-to-static decision is
 * made in exactly one place and reads as a plain boolean. `null` is treated as
 * "no reduction" so the first paint is never held back waiting on the query,
 * while a genuine reduce preference always wins the moment it resolves.
 *
 * When this returns `true`, primitives render their final, resting state with no
 * transition: the page stays complete and beautiful, just still.
 */
export function useReducedMotion(): boolean {
  return useFramerReducedMotion() === true;
}
