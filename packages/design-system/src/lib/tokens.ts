/*
 * Token resolution for charts and other canvas-drawn surfaces.
 *
 * Elements styled with Tailwind read the semantic tokens through CSS, so they
 * follow light and dark for free. A chart drawn to a canvas cannot: it needs a
 * concrete color string. These helpers read the resolved value of a design
 * token from the document so a chart's colors always match the active theme and
 * no chart ever hard-codes a hex.
 *
 * The fallback map below is the documented token-to-hex resolver: it mirrors the
 * light-theme token values one to one, and is only ever used in a non-browser
 * environment (server render or a test) where no computed style exists. In the
 * browser the live token value always wins, so light and dark are honored.
 */

/** Read the resolved value of a CSS custom property from an element (defaulting to :root). */
export function readCssVar(name: string, el?: Element | null): string {
  const target =
    el ?? (typeof document !== 'undefined' && document.documentElement ? document.documentElement : null);
  if (!target || typeof getComputedStyle !== 'function') {
    return '';
  }
  return getComputedStyle(target).getPropertyValue(name).trim();
}

/**
 * The documented light-theme values for the tokens charts use. These are never
 * a source of truth for the running app; the CSS variables are. They exist only
 * so a chart still resolves a sensible color when no document is available.
 */
const TOKEN_FALLBACK: Record<string, string> = {
  '--color-brand': '#743930',
  '--color-accent': '#996350',
  '--color-highlight': '#e5bea0',
  '--color-text-primary': '#2b1c17',
  '--color-text-secondary': '#6b544b',
  '--color-text-on-brand': '#ffffff',
  '--color-border': '#e7dad4',
  '--color-success': '#5b8c6e',
  '--color-warning': '#c98a3c',
  '--color-danger': '#c8402f',
  '--color-info': '#3d7a8c',
};

/** Resolve one design token to a concrete color, falling back to its documented value. */
export function chartColorFromToken(name: string, el?: Element | null): string {
  const value = readCssVar(name, el);
  return value || TOKEN_FALLBACK[name] || 'transparent';
}

/** The colors a chart needs, all resolved from the active theme's tokens. */
export interface ChartPalette {
  /** Ordered series colors, harmonized with the palette. */
  series: string[];
  brand: string;
  accent: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  /** Primary text, for labels. */
  text: string;
  /** Muted text, for axes and secondary labels. */
  textMuted: string;
  /** Text that sits on a brand or ink fill, for example a tooltip. */
  textOnBrand: string;
  /** Grid and axis lines. */
  border: string;
}

/**
 * Resolve the full chart palette from the design tokens on the given element
 * (the document root by default). Call this whenever the theme changes so a
 * chart repaints in the active theme.
 */
export function resolveChartPalette(el?: Element | null): ChartPalette {
  const brand = chartColorFromToken('--color-brand', el);
  const accent = chartColorFromToken('--color-accent', el);
  const success = chartColorFromToken('--color-success', el);
  const warning = chartColorFromToken('--color-warning', el);
  const danger = chartColorFromToken('--color-danger', el);
  const info = chartColorFromToken('--color-info', el);
  return {
    brand,
    accent,
    success,
    warning,
    danger,
    info,
    text: chartColorFromToken('--color-text-primary', el),
    textMuted: chartColorFromToken('--color-text-secondary', el),
    textOnBrand: chartColorFromToken('--color-text-on-brand', el),
    border: chartColorFromToken('--color-border', el),
    series: [brand, info, success, warning, accent, danger],
  };
}

/** Whether the viewer prefers reduced motion, so charts can skip their animation. */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
