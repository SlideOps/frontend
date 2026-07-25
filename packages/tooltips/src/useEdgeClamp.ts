import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';

/** The breathing room kept between an overlay and the viewport edge, in pixels. */
const VIEWPORT_GUTTER = 8;

/**
 * Keep an absolutely positioned overlay inside the viewport horizontally. A
 * tooltip or popover anchored near the right edge would otherwise spill off and
 * get clipped; this measures the overlay once it opens and nudges it back with a
 * horizontal margin so it stays fully visible on either side. The margin shifts
 * only the box, so the anchor and vertical placement are untouched.
 */
export function useEdgeClamp<T extends HTMLElement>(open: boolean) {
  const ref = useRef<T | null>(null);
  const [shift, setShift] = useState(0);

  useLayoutEffect(() => {
    if (!open) {
      setShift(0);
      return;
    }
    const element = ref.current;
    if (!element || typeof window === 'undefined') {
      return;
    }
    // Measure from the unshifted position so the correction is absolute rather
    // than compounding on a previous nudge.
    const previous = element.style.marginLeft;
    element.style.marginLeft = '0px';
    const rect = element.getBoundingClientRect();
    element.style.marginLeft = previous;

    const overflowRight = rect.right - (window.innerWidth - VIEWPORT_GUTTER);
    const overflowLeft = VIEWPORT_GUTTER - rect.left;
    let next = 0;
    if (overflowRight > 0) {
      next = -overflowRight;
    } else if (overflowLeft > 0) {
      next = overflowLeft;
    }
    setShift(Math.round(next));
  }, [open]);

  const style: CSSProperties = shift ? { marginLeft: `${shift}px` } : {};
  return { ref, style };
}
