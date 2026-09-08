import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { Placement } from './Tooltip';
import { useEdgeClamp } from './useEdgeClamp';

export interface PopoverProps {
  /** Render the trigger. The provided props wire up the open state and a11y. */
  trigger: (props: {
    'aria-expanded': boolean;
    'aria-controls': string;
    'aria-haspopup': 'dialog';
    onClick: () => void;
  }) => ReactNode;
  /** Longer guidance content. Fully interactive, unlike a tooltip. */
  children: ReactNode;
  /** Accessible label for the panel. */
  label: string;
  placement?: Placement;
  /**
   * Which of the trigger's edges the panel lines up with. A trigger sitting at
   * the right of the screen, the header bell being the case that forced this,
   * needs 'end' so the panel opens inward across the app rather than outward
   * off the edge, where the edge clamp can only drag it partly back.
   */
  align?: PopoverAlign;
}

export type PopoverAlign = 'start' | 'end';

/**
 * Where the panel sits relative to the trigger. A panel above or below lines up
 * with a horizontal edge; one to the side lines up with a vertical one.
 */
const placementClass: Record<Placement, Record<PopoverAlign, string>> = {
  top: { start: 'bottom-full left-0 mb-2', end: 'bottom-full right-0 mb-2' },
  bottom: { start: 'top-full left-0 mt-2', end: 'top-full right-0 mt-2' },
  left: { start: 'right-full top-0 mr-2', end: 'right-full bottom-0 mr-2' },
  right: { start: 'left-full top-0 ml-2', end: 'left-full bottom-0 ml-2' },
};

/**
 * An accessible popover for fuller explanations. It toggles on click, closes on
 * Escape and on an outside click, and never traps focus. It is labelled for
 * screen readers and is keyboard reachable through its trigger.
 */
export function Popover({
  trigger,
  children,
  label,
  placement = 'bottom',
  align = 'start',
}: PopoverProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const containerRef = useRef<HTMLSpanElement>(null);
  const clamp = useEdgeClamp<HTMLDivElement>(open);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        close();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, close]);

  return (
    <span ref={containerRef} className="relative inline-flex">
      {trigger({
        'aria-expanded': open,
        'aria-controls': panelId,
        'aria-haspopup': 'dialog',
        onClick: () => setOpen((value) => !value),
      })}
      {open ? (
        <div
          ref={clamp.ref}
          style={clamp.style}
          role="dialog"
          id={panelId}
          aria-label={label}
          className={`absolute z-50 w-72 max-w-[min(20rem,calc(100vw_-_1rem))] rounded-lg border border-border bg-surface p-4 text-sm leading-relaxed text-ink shadow-lg ${placementClass[placement][align]}`}
        >
          {children}
        </div>
      ) : null}
    </span>
  );
}
