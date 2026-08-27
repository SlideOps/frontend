import type { SVGProps } from 'react';

export interface MarkProps extends SVGProps<SVGSVGElement> {
  /** Square size in pixels applied to both width and height. */
  size?: number;
  /** Accessible label. Omit to mark the SVG as decorative. */
  title?: string;
}

/**
 * The SlideOps mark: a geometric two-tone fox, monochrome like the rest of
 * the dashboard now is. Its fills read the semantic --color-text-primary/
 * --color-text-secondary/--color-border/--color-bg-app tokens, the same ones
 * LogoLoader's assembling version of this same shape uses, through inline
 * style since CSS var() is not read inside a plain SVG fill attribute. Unlike
 * the raw --so-* primitives, these flip with the theme, so the mark is dark
 * on a light page and light on a dark one instead of staying one fixed color
 * regardless of which theme is active. The two small highlight facets and the
 * eyes read the page's own background color, so they sit as cutouts rather
 * than a third, unrelated tone.
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
          style={{ fill: 'var(--color-text-primary)' }}
        />
        <polygon
          points="50,31 59,31 84,15 72,45 79,51 65,73 50,86"
          style={{ fill: 'var(--color-text-secondary)' }}
        />
        <polygon points="37,53 50,59 63,53 50,84" style={{ fill: 'var(--color-border)' }} />
        <polygon points="28,45 42,48 34,55" style={{ fill: 'var(--color-bg-app)' }} />
        <polygon points="72,45 58,48 66,55" style={{ fill: 'var(--color-bg-app)' }} />
        <polygon points="33,48 39,50 35,53" style={{ fill: 'var(--color-bg-app)' }} />
        <polygon points="67,48 61,50 65,53" style={{ fill: 'var(--color-bg-app)' }} />
        <polygon points="46,64 54,64 50,70" style={{ fill: 'var(--color-bg-app)' }} />
      </g>
    </svg>
  );
}
