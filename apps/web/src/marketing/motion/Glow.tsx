import { cn } from '@slideops/design-system';
import type { CSSProperties } from 'react';
import { useReducedMotion } from './useReducedMotion';

/** The warm ember colours a glow can take, each mapped to a design token. */
export type GlowColor = 'warm' | 'ember' | 'rose';

const glowToken: Record<GlowColor, string> = {
  warm: 'var(--so-glow-warm)',
  ember: 'var(--so-glow-ember)',
  rose: 'var(--so-glow-rose)',
};

interface GlowProps {
  /** Which ember token to use. Defaults to the cognac `warm` glow. */
  color?: GlowColor;
  /** Diameter of the glow (any CSS length). */
  size?: number | string;
  /** Horizontal anchor (CSS `left`); the glow is centred on this point. */
  x?: string;
  /** Vertical anchor (CSS `top`); the glow is centred on this point. */
  y?: string;
  /** Slowly breathe in and out. Disabled automatically under reduced motion. */
  pulse?: boolean;
  className?: string;
  style?: CSSProperties;
}

/**
 * Glow: a soft, positionable radial ember from the warm palette.
 *
 * These are the embers and warm horizons of the marketing aesthetic. A glow is
 * an absolutely positioned, centred radial gradient that fades to nothing at its
 * edge, so several can be layered to build the ambient warmth behind a section.
 * Its colour is always a design token, so it stays on-palette in both themes.
 *
 * With `pulse`, it breathes on a slow, seamless loop using a compositor-friendly
 * transform-and-opacity CSS animation, so there is no per-frame layout work.
 * Under a reduce-motion preference the pulse is dropped and the glow renders
 * static, still warm and complete. It is decorative and hidden from assistive
 * tech, and it never intercepts pointer input.
 */
export function Glow({
  color = 'warm',
  size = '40rem',
  x = '50%',
  y = '50%',
  pulse = false,
  className,
  style,
}: GlowProps) {
  const reduced = useReducedMotion();
  const animate = pulse && !reduced;

  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute rounded-pill', animate && 'so-glow-pulse', className)}
      style={{
        width: size,
        height: size,
        left: x,
        top: y,
        transform: 'translate(-50%, -50%)',
        background: `radial-gradient(circle at center, ${glowToken[color]} 0%, transparent 70%)`,
        ...style,
      }}
    />
  );
}
