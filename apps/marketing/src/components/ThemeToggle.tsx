import { useTheme } from '@slideops/design-system';
import { Moon, Sun } from '@slideops/icons';

/** A quiet theme toggle. Both themes are first class, so this is always offered. */
export function ThemeToggle() {
  const { resolved, toggle } = useTheme();
  const isDark = resolved === 'dark';
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      className="inline-flex h-10 w-10 items-center justify-center rounded-md text-ink-muted transition-colors duration-fast ease-standard hover:bg-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
    >
      {isDark ? <Sun width={18} height={18} aria-hidden /> : <Moon width={18} height={18} aria-hidden />}
    </button>
  );
}
