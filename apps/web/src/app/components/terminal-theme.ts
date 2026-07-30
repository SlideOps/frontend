import type { ITheme } from '@xterm/xterm';

/*
 * Terminal colours, resolved from the design tokens so a terminal belongs to
 * whichever theme is in use rather than being a black rectangle pasted onto the
 * page. Shared, because there are two terminals now and they should not drift.
 */

/** Resolve a semantic color token to a concrete color the terminal can use. */
function resolveColor(varName: string): string | undefined {
  if (typeof document === 'undefined' || !document.body) {
    return undefined;
  }
  const probe = document.createElement('span');
  probe.style.color = `var(${varName})`;
  probe.style.position = 'absolute';
  probe.style.visibility = 'hidden';
  document.body.appendChild(probe);
  const value = getComputedStyle(probe).color;
  probe.remove();
  return value || undefined;
}

export function terminalTheme(): ITheme {
  const theme: ITheme = {};
  const mappings: Array<[keyof ITheme, string]> = [
    ['background', '--color-bg-app'],
    ['foreground', '--color-text-primary'],
    ['cursor', '--color-accent'],
    ['green', '--color-success'],
    ['red', '--color-danger'],
    ['yellow', '--color-warning'],
    ['blue', '--color-info'],
    ['cyan', '--color-info'],
    ['brightBlack', '--color-text-secondary'],
  ];
  for (const [key, varName] of mappings) {
    const value = resolveColor(varName);
    if (value) {
      (theme as Record<string, string>)[key] = value;
    }
  }
  return theme;
}
