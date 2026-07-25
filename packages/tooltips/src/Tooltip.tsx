import {
  cloneElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import { useEdgeClamp } from './useEdgeClamp';

export type Placement = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps {
  /** The content shown in the bubble. Written in plain language, no jargon. */
  content: ReactNode;
  /** A single focusable trigger element. */
  children: ReactElement;
  placement?: Placement;
  /** Delay before a hover opens the tooltip, in milliseconds. */
  openDelay?: number;
  /** Duration of a touch press and hold before the tooltip opens. */
  pressDelay?: number;
}

const placementClass: Record<Placement, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
};

/**
 * An accessible tooltip. It opens on hover, on keyboard focus, and on a touch
 * press and hold. It never moves focus, so it is not a focus trap, and it can
 * always be dismissed with Escape. The trigger is described by the bubble
 * through aria-describedby while it is visible.
 */
export function Tooltip({
  content,
  children,
  placement = 'top',
  openDelay = 120,
  pressDelay = 400,
}: TooltipProps) {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();
  const clamp = useEdgeClamp<HTMLSpanElement>(open);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (openTimer.current) {
      clearTimeout(openTimer.current);
      openTimer.current = null;
    }
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const show = useCallback(
    (delay: number) => {
      clearTimers();
      openTimer.current = setTimeout(() => setOpen(true), delay);
    },
    [clearTimers],
  );

  const hide = useCallback(() => {
    clearTimers();
    setOpen(false);
  }, [clearTimers]);

  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape' && open) {
        event.stopPropagation();
        hide();
      }
    },
    [hide, open],
  );

  const childProps = children.props as Record<string, unknown>;

  const trigger = cloneElement(children, {
    'aria-describedby': open ? tooltipId : (childProps['aria-describedby'] as string | undefined),
    onMouseEnter: () => show(openDelay),
    onMouseLeave: hide,
    onFocus: () => setOpen(true),
    onBlur: hide,
    onKeyDown,
    onTouchStart: () => show(pressDelay),
    onTouchEnd: hide,
    onTouchCancel: hide,
  } as Record<string, unknown>);

  return (
    <span className="relative inline-flex" onMouseLeave={hide}>
      {trigger}
      {open ? (
        <span
          ref={clamp.ref}
          style={clamp.style}
          role="tooltip"
          id={tooltipId}
          className={`pointer-events-none absolute z-50 w-max max-w-[min(20rem,calc(100vw_-_1rem))] rounded-md bg-ink px-3 py-2 text-sm leading-snug text-surface shadow-md ${placementClass[placement]}`}
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}
