import { cn } from '@slideops/design-system';
import { AlertTriangle, ArrowRight, CheckCircle2, Info, X, XCircle } from '@slideops/icons';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    const fresh = items.filter((item) => !seen.current.has(item.id));
    if (fresh.length === 0) {
      return;
    }
    for (const item of fresh) {
      seen.current.add(item.id);
    }
    // An inbox notification the durable backend already has marked read (from a
    // prior session, or an earlier visit this same one) has already been shown
    // to the Operator once. It still belongs in the bell's list, but "not yet
    // seen by this particular page load" is not the same question as "not yet
    // seen by the Operator", and toasting it again on every fresh login was
    // exactly that mistake: the same already-read notification popping up
    // forever, on every browser, since a fresh mount has never personally seen
    // it before either.
    const toastWorthy = fresh.filter((item) => !item.read);
    if (toastWorthy.length === 0) {
      return;
    }
    setActive((current) => [...toastWorthy, ...current].slice(0, 3));
    // A persistent notification waits until acted on, so it gets no dismiss timer.
    const timers = toastWorthy
      .filter((item) => !item.persistent)
      .map((item) =>
        setTimeout(() => {
          setActive((current) => current.filter((toast) => toast.id !== item.id));
        }, TOAST_MS),
      );
    return () => timers.forEach(clearTimeout);
  }, [items]);

  if (active.length === 0) {
    return null;
  }

  const dismiss = (id: string) =>
    setActive((current) => current.filter((toast) => toast.id !== id));

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
