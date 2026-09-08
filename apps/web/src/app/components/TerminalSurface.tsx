import { Button, cn, prefersReducedMotion } from '@slideops/design-system';
import { Maximize2, Minimize2 } from '@slideops/icons';
import { useEffect, useState, type ReactNode, type RefObject, type UIEventHandler } from 'react';

/*
 * The one surface every terminal and every log view in this app sits on.
 *
 * There used to be four of them: the single-session shell, a shell tab, an
 * Operation's live output and the Service log viewer. Each had invented its own
 * height, its own padding and its own idea of whether it could be made bigger,
 * so they drifted apart, and only one of the four could be expanded at all,
 * which is the first thing anybody wants from a box of streaming text.
 *
 * So sizing, the expand toggle, the breathing room around the content and the
 * light underneath all live here. The emulators and the log renderers keep
 * rendering exactly as they did: this is a frame, and it never touches a
 * session, a socket or what is written into one.
 *
 * The rule that makes expanding safe: this component only ever changes classes
 * and an inline height on elements that are already mounted. The shape of the
 * tree is identical expanded and collapsed, and there is deliberately no portal,
 * so React reconciles rather than remounts and the content element the caller
 * handed to xterm survives the toggle along with everything written into it.
 */

/** Collapsed height of the content region, when it is not filling its parent. */
const DEFAULT_HEIGHT = '24rem';

/*
 * The browser applies the new layout after React commits, so an emulator asked
 * to remeasure in the same tick would measure the size it is leaving.
 */
const RESIZE_SETTLE_MS = 60;

/** Whether the viewer asked for less motion, kept current if they change it. */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(prefersReducedMotion);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const listener = () => setReduced(query.matches);
    query.addEventListener('change', listener);
    return () => query.removeEventListener('change', listener);
  }, []);

  return reduced;
}

export interface TerminalSurfaceProps {
  /**
   * What this surface holds, as a noun phrase: "the terminal", "the log".
   *
   * It becomes the expand control's accessible name, so a screen reader hears
   * which of several surfaces on a page it is about to fill the window with
   * rather than three identical buttons called "Expand".
   */
  label: string;
  /** Leading toolbar content: a title, a status indicator, whatever names this surface on screen. */
  toolbar?: ReactNode;
  /** Trailing toolbar controls, kept in their own order and placed before the expand control. */
  actions?: ReactNode;
  /** One sentence under the toolbar. Hidden while expanded, so the content gets the room. */
  caption?: ReactNode;
  /** Alerts and notes between the toolbar and the content. */
  notice?: ReactNode;
  /** Anything under the content, such as a jump-to-latest control. */
  footer?: ReactNode;
  /** Whether this surface currently fills the window. */
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  /** Withholds the expand control while there is nothing worth filling the window with. */
  canExpand?: boolean;
  /** Collapsed height of the content region. Ignored when it fills its parent. */
  height?: string;
  /**
   * Grows the content region to its parent's height instead of taking a fixed
   * one, for a surface that is already the whole point of the page it is on.
   */
  fill?: boolean;
  /** Hides the content region without unmounting it, so a terminal's own element survives. */
  contentHidden?: boolean;
  /** Lets the content region scroll itself. A plain-text log does; an emulator scrolls its own way. */
  scrolls?: boolean;
  /** Gives the collapsed content region the drag handle a textarea has. */
  resizable?: boolean;
  /** ARIA role for the content region, for a surface that is a live region. */
  contentRole?: 'log';
  /** Accessible name for the content region, when it has a role. */
  contentLabel?: string;
  contentClassName?: string;
  contentRef?: RefObject<HTMLDivElement>;
  onContentScroll?: UIEventHandler<HTMLDivElement>;
  /**
   * Called whenever the content region's size may have changed: expanding,
   * collapsing, the window resizing, the Operator dragging it taller.
   *
   * An emulator measures its container once and keeps that geometry, so a
   * surface that grew without saying so leaves an eighty column terminal in the
   * middle of a wide window, which looks exactly like the expand having done
   * nothing. Pass a stable callback; it is registered as a listener.
   */
  onResize?: () => void;
  /** Extra classes for the surface root, applied while it is not filling the window. */
  className?: string;
  children?: ReactNode;
}

export function TerminalSurface({
  label,
  toolbar,
  actions,
  caption,
  notice,
  footer,
  expanded,
  onExpandedChange,
  canExpand = true,
  height = DEFAULT_HEIGHT,
  fill = false,
  contentHidden = false,
  scrolls = false,
  resizable = false,
  contentRole,
  contentLabel,
  contentClassName,
  contentRef,
  onContentScroll,
  onResize,
  className,
  children,
}: TerminalSurfaceProps) {
  const reducedMotion = useReducedMotion();

  // Escape leaves the expanded view, because that is what Escape does everywhere
  // else and a control you can enter and not leave by reflex is a trap.
  useEffect(() => {
    if (!expanded) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onExpandedChange(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded, onExpandedChange]);

  // Expanding and collapsing resize the content region without the window
  // changing at all, so nothing else would ever tell the emulator.
  useEffect(() => {
    if (!onResize) {
      return;
    }
    const id = window.setTimeout(onResize, RESIZE_SETTLE_MS);
    return () => window.clearTimeout(id);
  }, [expanded, onResize]);

  useEffect(() => {
    if (!onResize) {
      return;
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [onResize]);

  // A surface the Operator drags taller changes size with no event of its own,
  // so the box itself is watched wherever the browser can watch it.
  useEffect(() => {
    const element = contentRef?.current;
    if (!onResize || !element || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(() => onResize());
    observer.observe(element);
    return () => observer.disconnect();
  }, [onResize, contentRef]);

  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-3',
        expanded
          ? // Fixed rather than a modal: there is nothing to dismiss by clicking
            // away, and a shell that closed because somebody clicked beside it
            // would be a very unwelcome surprise mid command. Filling the window
            // also keeps the browser's own chrome where it is, which the native
            // fullscreen API does not.
            'fixed inset-0 z-50 bg-app p-4'
          : className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        {toolbar}
        {/* The window control sits to the right, where a window's controls are,
            and after the surface's own controls so those keep their positions. */}
        <span className="ml-auto flex items-center gap-1">
          {actions}
          {canExpand ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onExpandedChange(!expanded)}
              title={expanded ? 'Leave full screen (Esc)' : 'Fill the window'}
              aria-label={
                expanded ? `Leave full screen for ${label}` : `Fill the window with ${label}`
              }
              aria-pressed={expanded}
            >
              {expanded ? (
                <Minimize2 width={15} height={15} aria-hidden />
              ) : (
                <Maximize2 width={15} height={15} aria-hidden />
              )}
            </Button>
          ) : null}
        </span>
      </div>

      {expanded ? null : caption}
      {notice}

      {/* The frame reserves the few pixels the light needs. The glow is
          absolutely positioned inside it, so it takes part in no layout and can
          move nothing, and it is painted before the content box, which is opaque,
          so it stays behind and beneath the text rather than over it. */}
      <div
        className={cn(
          'relative isolate min-w-0',
          'p-[5px]',
          expanded || fill ? 'min-h-0 flex-1' : null,
        )}
      >
        <span
          aria-hidden
          className={cn('so-glow-pool', reducedMotion ? 'so-glow-pool-static' : null)}
        />
        <div
          ref={contentRef}
          role={contentRole}
          aria-label={contentLabel}
          onScroll={onContentScroll}
          className={cn(
            // box-border so the 5px of breathing room comes out of the box rather
            // than being added to the height the caller asked for.
            'relative z-10 box-border w-full min-w-0 rounded-md border border-border bg-app p-[5px]',
            scrolls ? 'overflow-auto' : 'overflow-hidden',
            // A floor as well as a handle: dragged to nothing, a terminal cannot
            // be found again, because the thing you would grab to grow it is the
            // edge you just collapsed.
            resizable && !expanded ? 'resize-y min-h-32' : null,
            expanded || fill ? 'h-full' : null,
            contentHidden ? 'hidden' : 'block',
            contentClassName,
          )}
          // A height, never a max-height: the content region has to be able to
          // grow past the size it started at, which is the whole point of both
          // the drag handle and the expand control.
          style={expanded || fill ? undefined : { height }}
        >
          {children}
        </div>
      </div>

      {footer}
    </div>
  );
}
