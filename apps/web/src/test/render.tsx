import { ThemeProvider } from '@slideops/design-system';
import { GuidanceProvider } from '@slideops/tooltips';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { guidance } from '../guidance';

/*
 * Render a component the way the application renders it.
 *
 * The providers here mirror main.tsx, in the same order: theme, then guidance. A
 * component that reads one throws without it, and a whole screen reads both
 * through the shell it sits in. Mocking them away would pass a test while the
 * real screen crashed on load, so the real ones are used, with the real guidance
 * registry.
 *
 * The router is deliberately not included. A screen that navigates needs one and
 * should say so by wrapping itself in a MemoryRouter, where the test can control
 * the entry route; supplying one here would hide that requirement.
 */

function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <GuidanceProvider registry={guidance}>{children}</GuidanceProvider>
    </ThemeProvider>
  );
}

/** render, with the providers every screen runs inside. */
export function renderInApp(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
): RenderResult {
  return render(ui, { wrapper: Providers, ...options });
}
