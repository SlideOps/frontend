import { Mark } from './Mark';

export interface LogoProps {
  /** Height of the mark in pixels; the wordmark scales with it. */
  size?: number;
  /** Hide the wordmark and render the mark alone. */
  markOnly?: boolean;
  className?: string;
}

/**
 * The default SlideOps lockup: the fox mark beside the wordmark. The wordmark
 * uses the current text color so it reads correctly in light and dark. Use
 * markOnly where space is tight.
 */
export function Logo({ size = 32, markOnly = false, className }: LogoProps) {
  return (
    <span className={className} style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <Mark size={size} title="SlideOps" />
      {markOnly ? null : (
        <span
          style={{
            fontFamily: 'Poppins, Inter, system-ui, sans-serif',
            fontWeight: 600,
            fontSize: size * 0.62,
            letterSpacing: '-0.01em',
            color: 'currentColor',
          }}
        >
          SlideOps
        </span>
      )}
    </span>
  );
}
