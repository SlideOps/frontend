import { cn } from '@slideops/design-system';
import type { CSSProperties } from 'react';

/**
 * A tiled fractal-noise texture, generated once as an inline SVG feTurbulence
 * and used as an alpha mask. It ships inside the bundle, so there is no external
 * request. The noise only shapes the transparency; the actual color comes from
 * the `--so-grain-color` token, so the grain reads correctly in both themes.
 */
const noise = `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'>
  <filter id='g'>
    <feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/>
  </filter>
  <rect width='100%' height='100%' filter='url(#g)'/>
</svg>`;
const noiseMask = `url("data:image/svg+xml;utf8,${encodeURIComponent(noise)}")`;

interface GrainProps {
  className?: string;
  style?: CSSProperties;
  /** Override the token opacity for a heavier or lighter texture. */
  opacity?: number;
}

/**
 * Grain: a subtle, static paper-like noise overlay.
 *
 * It gives the warm-dark surfaces the tactile, printed depth of the inspiration
 * still. The layer is a single fixed element with no animation and no per-frame
 * work, so it costs nothing once painted; it is identical under a reduce-motion
 * preference. Colour and default opacity are pulled from the design tokens,
 * never hard-coded, and it is decorative, so it is hidden from assistive tech.
 */
export function Grain({ className, style, opacity }: GrainProps) {
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none fixed inset-0', className)}
      style={{
        backgroundColor: 'rgb(var(--so-grain-color))',
        opacity: opacity ?? 'var(--so-grain-opacity)',
        WebkitMaskImage: noiseMask,
        maskImage: noiseMask,
        WebkitMaskSize: '160px 160px',
        maskSize: '160px 160px',
        mixBlendMode: 'overlay',
        ...style,
      }}
    />
  );
}
