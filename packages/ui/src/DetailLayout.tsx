import { cn } from '@slideops/design-system';
import type { ReactNode } from 'react';

/*
 * The two-column shape a resource's own detail page shares: the page's own
 * sections in reading order, and a fixed-width rail of supporting material
 * beside them -- summary facts, capacity, a form to start something. Every
 * detail page used to pick its own rail width and side; this is the one
 * shape all of them share now.
 */

export interface DetailLayoutProps {
  /** The wide column: the page's own sections, in reading order. */
  main: ReactNode;
  /** The fixed-width column, docked right: supporting material, not the primary read. */
  rail: ReactNode;
  className?: string;
}

export function DetailLayout({ main, rail, className }: DetailLayoutProps) {
  return (
    <div className={cn('grid gap-6 lg:grid-cols-[1fr_20rem]', className)}>
      <div className="flex min-w-0 flex-col gap-8">{main}</div>
      <div className="flex min-w-0 flex-col gap-8">{rail}</div>
    </div>
  );
}
