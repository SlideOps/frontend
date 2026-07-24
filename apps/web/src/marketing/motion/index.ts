/**
 * The marketing motion system.
 *
 * The reusable, token-driven building blocks the living marketing experience is
 * composed from: scroll-driven reveals, ambient warmth (glow and grain), and the
 * single reduced-motion signal every primitive degrades through. This module is
 * imported only by marketing components, so Framer Motion and these primitives
 * are code-split into the marketing chunks and never weigh on the operator app
 * or the admin control plane.
 *
 * Later chunks add the node network and the dotted globe; those are
 * intentionally not part of this foundation.
 */
export { useReducedMotion } from './useReducedMotion';
export { Reveal } from './Reveal';
export { WordReveal } from './WordReveal';
export { Glow, type GlowColor } from './Glow';
export { Grain } from './Grain';
export { SectionFold, type FoldDirection, type FoldDensity } from './SectionFold';
export {
  revealVariants,
  wordRevealVariants,
  entranceEase,
  revealDuration,
  revealOffset,
  type RevealDirection,
  type RevealKind,
} from './variants';
