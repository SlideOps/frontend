import { cn } from '@slideops/design-system';
import { AlertTriangle, ArrowRight, CheckCircle2, Info, X, XCircle } from '@slideops/icons';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { hasToastShown, rememberToastShown } from './shownToasts';
import type { AppNotification, NotificationTone } from './store';
import { useNotificationsStore } from './store';

const TOAST_MS = 6000;

const toneIcon: Record<NotificationTone, typeof CheckCircle2> = {
  success: CheckCircle2,
  danger: XCircle,
  info: Info,
};

const toneColor: Record<NotificationTone, string> = {
  success: 'text-success',
  danger: 'text-danger',
  info: 'text-info',
};

/**
 * Transient toasts for new results. A notification appears briefly at the corner
 * as it arrives and eases away on its own, so a completion is never missed but
 * the screen stays calm. A notification marked persistent - one that needs the
 * Operator, like a plan waiting for approval - does not ease away: it waits on
 * screen until it is reviewed or dismissed. The full list lives in the
 * notifications panel.
 */
export function Toaster() {
  const navigate = useNavigate();
  const items = useNotificationsStore((state) => state.items);
  const [active, setActive] = useState<AppNotification[]>([]);
  /** The pending dismiss countdown for each toast on screen, by notification id. */
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    // Two independent reasons not to toast, and both are needed.
    //
    // Read covers an inbox notification the durable backend already has marked
    // read, from a prior session or an earlier visit this same one: the
    // Operator has dealt with it, so it belongs in the bell's list and nowhere
    // else. But read alone was the whole guard, and for a notification that
    // lives only in the live event stream, read state never leaves memory. A
    // reload rebuilt it unread and it popped up again, forever.
    //
    // So the second reason is this browser's own record of having already put
    // the thing on screen, which survives the reload that read state does not.
    const toastWorthy = items.filter((item) => !item.read && !hasToastShown(item.id));
    if (toastWorthy.length === 0) {
      return;
    }
    // Recorded as it appears rather than as it is dismissed, so a toast the
    // Operator watched ease away on its own still counts as having been shown.
    for (const item of toastWorthy) {
      rememberToastShown(item.id);
    }
    setActive((current) => [...toastWorthy, ...current].slice(0, 3));
    // A persistent notification waits until acted on, so it gets no dismiss timer.
    //
    // The timers are held across renders rather than cleaned up when items
    // changes. Clearing them there cancelled the countdown of every toast
    // already on screen the moment a new notification arrived, so a busy
    // Workspace left toasts stacked up and never leaving: the effect tidied
    // away the timers of toasts it had nothing to do with.
    for (const item of toastWorthy) {
      if (item.persistent) {
        continue;
      }
      const timer = setTimeout(() => {
        timers.current.delete(item.id);
        setActive((current) => current.filter((toast) => toast.id !== item.id));
      }, TOAST_MS);
      timers.current.set(item.id, timer);
    }
  }, [items]);

  // Only unmounting cancels a countdown, which is the one moment there is
  // nothing left to count down for.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) {
        clearTimeout(timer);
      }
      pending.clear();
    };
  }, []);

  if (active.length === 0) {
    return null;
  }

  const dismiss = (id: string) => {
    const pending = timers.current.get(id);
    if (pending !== undefined) {
      clearTimeout(pending);
      timers.current.delete(id);
    }
    setActive((current) => current.filter((toast) => toast.id !== id));
  };

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 md:inset-x-auto md:bottom-6 md:right-6 md:items-end md:px-0"
      aria-live="polite"
    >
      {active.map((toast) => {
        const actionRequired = toast.kind === 'action_required';
        const Icon = actionRequired ? AlertTriangle : toneIcon[toast.tone];
        const target =
          toast.href ?? (toast.operationId ? `/app/operations/${toast.operationId}` : '/app');
        return (
          <div
            key={toast.id}
            // A persistent, attention-calling toast is announced assertively; the
            // warning accent border sets it apart from a routine success toast.
            role={toast.persistent ? 'alert' : undefined}
            className={cn(
              'so-toast pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border bg-raised p-4 shadow-lg',
              actionRequired ? 'border-l-4 border-warning' : 'border-border',
            )}
          >
            <Icon
              width={20}
              height={20}
              className={cn(
                'mt-0.5 shrink-0',
                actionRequired ? 'text-warning' : toneColor[toast.tone],
              )}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => {
                  dismiss(toast.id);
                  navigate(target);
                }}
                className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                <p className="truncate text-sm font-medium text-ink">{toast.title}</p>
                <p className="mt-0.5 truncate text-sm text-ink-muted">{toast.body}</p>
              </button>
              {toast.href ? (
                <button
                  type="button"
                  onClick={() => {
                    dismiss(toast.id);
                    navigate(target);
                  }}
                  className="mt-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-warning transition-colors duration-fast ease-standard hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                >
                  Review
                  <ArrowRight width={14} height={14} aria-hidden />
                </button>
              ) : null}
            </div>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => dismiss(toast.id)}
              className="shrink-0 rounded-pill p-1 text-ink-muted transition-colors duration-fast ease-standard hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              <X width={16} height={16} aria-hidden />
            </button>
          </div>
        );
      })}
    </div>
  );
}
