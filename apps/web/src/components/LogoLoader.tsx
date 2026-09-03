/*
 * The one loading indicator for the whole application. Every waiting state, from
 * a route split arriving to a panel fetching its data, shows the SlideOps fox
 * mark assembling itself from its polygons rather than a generic spinner, so the
 * wait always feels like the product.
 *
 * The artwork is the geometric two-tone fox: a left ear, a right ear, the snout,
 * two eyes and the nose. The fills reference the semantic color tokens (the
 * same ones Mark.tsx uses) through inline style because CSS var() is not read
 * inside an SVG fill attribute, so the mark inverts with the theme rather than
 * staying one fixed color regardless of which one is active. The assemble
 * motion lives in index.css as keyframes; the resting, non-animated state of
 * every piece is the fully assembled fox, so the global reduced-motion guard
 * leaves a complete mark rather than a half frame.
 */

type NamedSize = 'sm' | 'md' | 'lg';

const NAMED_SIZE: Record<NamedSize, number> = {
  sm: 28,
  md: 44,
  lg: 72,
};

export interface LogoLoaderProps {
  /** Mark size in pixels, or a named step. Defaults to md, or lg full screen. */
  size?: number | NamedSize;
  /** Text shown under the mark and announced to assistive technology. */
  label?: string;
  /** Center the mark in a full viewport-height, token-background screen. */
  fullScreen?: boolean;
}

/** The assembling fox mark, drawn inline so it stays crisp and theme-aware. */
function AssemblingMark({ size }: { size: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="9 9 82 82"
      aria-hidden
      role="presentation"
    >
      <polygon
        className="so-assemble-ear-left"
        points="50,31 41,31 16,15 28,45 21,51 35,73 50,86"
        style={{ fill: 'var(--color-text-primary)' }}
      />
      <polygon
        className="so-assemble-ear-right"
        points="50,31 59,31 84,15 72,45 79,51 65,73 50,86"
        style={{ fill: 'var(--color-text-secondary)' }}
      />
      <polygon
        className="so-assemble-snout"
        points="37,53 50,59 63,53 50,84"
        style={{ fill: 'var(--color-border)' }}
      />
      <g className="so-assemble-eyes">
        <polygon points="28,45 42,48 34,55" style={{ fill: 'var(--color-bg-app)' }} />
        <polygon points="72,45 58,48 66,55" style={{ fill: 'var(--color-bg-app)' }} />
        <polygon points="33,48 39,50 35,53" style={{ fill: 'var(--color-bg-app)' }} />
        <polygon points="67,48 61,50 65,53" style={{ fill: 'var(--color-bg-app)' }} />
      </g>
      <polygon
        className="so-assemble-nose"
        points="46,64 54,64 50,70"
        style={{ fill: 'var(--color-bg-app)' }}
      />
    </svg>
  );
}

/**
 * The shared loader. Inline by default, suitable for a panel waiting on its
 * data; full screen when a whole route is arriving, centering the mark and its
 * label on a token background. The status role carries the label to assistive
 * technology while the decorative mark stays hidden from it.
 */
export function LogoLoader({ size, label, fullScreen = false }: LogoLoaderProps) {
  const resolved = size ?? (fullScreen ? 'lg' : 'md');
  const px = typeof resolved === 'number' ? resolved : NAMED_SIZE[resolved];
  const announced = label ?? 'Loading';

  const stack = (
    <div className="flex flex-col items-center justify-center gap-3">
      <AssemblingMark size={px} />
      {label ? <p className="text-sm text-ink-muted">{label}</p> : null}
    </div>
  );

  if (fullScreen) {
    return (
      <div
        role="status"
        aria-label={announced}
        className="flex min-h-dvh w-full flex-col items-center justify-center gap-4 bg-app text-ink"
      >
        {stack}
      </div>
    );
  }

  return (
    <div role="status" aria-label={announced} className="flex justify-center py-8">
      {stack}
    </div>
  );
}
