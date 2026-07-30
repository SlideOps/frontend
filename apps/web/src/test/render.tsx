import { GuidanceProvider } from '@slideops/tooltips';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { guidance } from '../guidance';

/*
 * Render a component the way the application renders it.
 *
 * Screens are wrapped in providers by main.tsx, and a component that reads one
 * throws without it. Mocking those providers away would pass a test while the
 * real screen crashed, so the real ones are used here with the real guidance
 * registry: a test that renders differently from the product proves nothing about
 * the product.
 */

function Providers({ children }: { children: ReactNode }) {
  return <GuidanceProvider registry={guidance}>{children}</GuidanceProvider>;
}

/** render, with the providers every screen runs inside. */
export function renderInApp(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
): RenderResult {
  return render(ui, { wrapper: Providers, ...options });
}
