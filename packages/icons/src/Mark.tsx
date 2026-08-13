import type { SVGProps } from 'react';

export interface MarkProps extends SVGProps<SVGSVGElement> {
  /** Square size in pixels applied to both width and height. */
  size?: number;
  /** Accessible label. Omit to mark the SVG as decorative. */
  title?: string;
}

/**
 * The SlideOps mark: a geometric two-tone fox drawn entirely from the brand
 * palette. Rendered inline so it inherits crispness at any size and needs no
 * network request. The artwork is fixed brand colour and is intentionally not
 * themed by tokens; its fills are chosen to match the current palette's
 * primitives (--so-marsala, --so-cognac, --so-peach, --so-neutral-100,
 * --so-ink) by value, so a future repaint here should follow theirs.
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
        <polygon points="50,31 41,31 16,15 28,45 21,51 35,73 50,86" fill="#3b5bdb" />
        <polygon points="50,31 59,31 84,15 72,45 79,51 65,73 50,86" fill="#5c7cfa" />
        <polygon points="37,53 50,59 63,53 50,84" fill="#a5b4fc" />
        <polygon points="28,45 42,48 34,55" fill="#eef1f5" />
        <polygon points="72,45 58,48 66,55" fill="#eef1f5" />
        <polygon points="33,48 39,50 35,53" fill="#10131a" />
        <polygon points="67,48 61,50 65,53" fill="#10131a" />
        <polygon points="46,64 54,64 50,70" fill="#10131a" />
      </g>
    </svg>
  );
}
