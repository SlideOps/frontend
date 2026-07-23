import type { SVGProps } from 'react';

export interface MarkProps extends SVGProps<SVGSVGElement> {
  /** Square size in pixels applied to both width and height. */
  size?: number;
  /** Accessible label. Omit to mark the SVG as decorative. */
  title?: string;
}

/**
 * The SlideOps mark: a geometric two-tone fox drawn entirely from the
 * Everlasting Beauty palette. Rendered inline so it inherits crispness at any
 * size and needs no network request. The artwork is fixed brand colour and is
 * intentionally not themed by tokens.
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
        <polygon points="50,31 41,31 16,15 28,45 21,51 35,73 50,86" fill="#743930" />
        <polygon points="50,31 59,31 84,15 72,45 79,51 65,73 50,86" fill="#996350" />
        <polygon points="37,53 50,59 63,53 50,84" fill="#e5bea0" />
        <polygon points="28,45 42,48 34,55" fill="#f7ece8" />
        <polygon points="72,45 58,48 66,55" fill="#f7ece8" />
        <polygon points="33,48 39,50 35,53" fill="#2b1c17" />
        <polygon points="67,48 61,50 65,53" fill="#2b1c17" />
        <polygon points="46,64 54,64 50,70" fill="#2b1c17" />
      </g>
    </svg>
  );
}
