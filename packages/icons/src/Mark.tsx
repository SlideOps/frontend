import type { SVGProps } from 'react';

export interface MarkProps extends SVGProps<SVGSVGElement> {
  /** Square size in pixels applied to both width and height. */
  size?: number;
  /** Accessible label. Omit to mark the SVG as decorative. */
  title?: string;
}

/**
 * The SlideOps mark: a geometric two-tone fox. Its fills read the same
 * --so-marsala/--so-cognac/--so-peach/--so-neutral-100/--so-ink primitives as
 * LogoLoader's assembling version of this same shape, through inline style
 * since CSS var() is not read inside a plain SVG fill attribute, so both
 * follow the palette automatically whenever those primitives repaint rather
 * than needing their hex values copied in by hand.
 */
export function Mark({ size = 40, title, ...rest }: MarkProps) {
  const decorative = title === undefined;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="9 9 82 82"
      role={decorative ? 'presentation' : 'img'}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : title}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      <g>
        <polygon
          points="50,31 41,31 16,15 28,45 21,51 35,73 50,86"
          style={{ fill: 'var(--so-marsala)' }}
        />
        <polygon
          points="50,31 59,31 84,15 72,45 79,51 65,73 50,86"
          style={{ fill: 'var(--so-cognac)' }}
        />
        <polygon points="37,53 50,59 63,53 50,84" style={{ fill: 'var(--so-peach)' }} />
        <polygon points="28,45 42,48 34,55" style={{ fill: 'var(--so-neutral-100)' }} />
        <polygon points="72,45 58,48 66,55" style={{ fill: 'var(--so-neutral-100)' }} />
        <polygon points="33,48 39,50 35,53" style={{ fill: 'var(--so-ink)' }} />
        <polygon points="67,48 61,50 65,53" style={{ fill: 'var(--so-ink)' }} />
        <polygon points="46,64 54,64 50,70" style={{ fill: 'var(--so-ink)' }} />
      </g>
    </svg>
  );
}
