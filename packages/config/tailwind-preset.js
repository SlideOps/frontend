/**
 * SlideOps Tailwind preset.
 *
 * Encodes the brand palette and the semantic design tokens. Every color
 * resolves to a CSS variable defined by the design-system token sheet, so
 * light and dark themes are handled purely at the variable level and no app
 * ever hard codes a hex value. Apps extend this preset and only add their
 * own content globs.
 */

/** @type {import('tailwindcss').Config} */
const preset = {
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // Raw brand palette, available where an artwork-accurate value is
        // needed. Product surfaces should prefer the semantic tokens below.
        rose: 'var(--so-rose-quartz)',
        peach: 'var(--so-peach)',
        cognac: 'var(--so-cognac)',
        marsala: 'var(--so-marsala)',

        // Semantic surface and text tokens.
        app: 'var(--color-bg-app)',
        surface: 'var(--color-bg-surface)',
        raised: 'var(--color-bg-raised)',
        subtle: 'var(--color-bg-subtle)',
        border: 'var(--color-border)',
        focus: 'var(--color-focus-ring)',
        ink: {
          DEFAULT: 'var(--color-text-primary)',
          muted: 'var(--color-text-secondary)',
        },
        brand: {
          DEFAULT: 'var(--color-brand)',
          hover: 'var(--color-brand-hover)',
          fg: 'var(--color-text-on-brand)',
        },
        accent: 'var(--color-accent)',
        highlight: 'var(--color-highlight)',
        overlay: 'var(--color-overlay)',

        // Functional status tokens.
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        danger: 'var(--color-danger)',
        info: 'var(--color-info)',
      },
      borderRadius: {
        sm: 'var(--so-radius-sm)',
        DEFAULT: 'var(--so-radius-md)',
        md: 'var(--so-radius-md)',
        lg: 'var(--so-radius-lg)',
        xl: 'var(--so-radius-xl)',
        pill: 'var(--so-radius-pill)',
      },
      boxShadow: {
        sm: 'var(--so-shadow-sm)',
        DEFAULT: 'var(--so-shadow-md)',
        md: 'var(--so-shadow-md)',
        lg: 'var(--so-shadow-lg)',
      },
      spacing: {
        1: 'var(--so-space-1)',
        2: 'var(--so-space-2)',
        3: 'var(--so-space-3)',
        4: 'var(--so-space-4)',
        6: 'var(--so-space-6)',
        8: 'var(--so-space-8)',
        12: 'var(--so-space-12)',
        16: 'var(--so-space-16)',
      },
      transitionTimingFunction: {
        standard: 'var(--so-ease-standard)',
        entrance: 'var(--so-ease-entrance)',
        exit: 'var(--so-ease-exit)',
      },
      transitionDuration: {
        fast: 'var(--so-duration-fast)',
        base: 'var(--so-duration-base)',
        slow: 'var(--so-duration-slow)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Poppins', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default preset;
