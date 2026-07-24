import { cn } from '@slideops/design-system';
import { CheckCircle2, Info, X, XCircle } from '@slideops/icons';
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
 * the screen stays calm. The full list lives in the notifications panel.
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
    setActive((current) => [...fresh, ...current].slice(0, 3));
    const timers = fresh.map((item) =>
      setTimeout(() => {
        setActive((current) => current.filter((toast) => toast.id !== item.id));
      }, TOAST_MS),
    );
    return () => timers.forEach(clearTimeout);
  }, [items]);

  if (active.length === 0) {
    return null;
  }

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 md:inset-x-auto md:bottom-6 md:right-6 md:items-end md:px-0"
      aria-live="polite"
    >
      {active.map((toast) => {
        const Icon = toneIcon[toast.tone];
        return (
          <div
            key={toast.id}
            className="so-toast pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border border-border bg-raised p-4 shadow-lg"
          >
            <Icon width={20} height={20} className={cn('mt-0.5 shrink-0', toneColor[toast.tone])} aria-hidden />
            <button
              type="button"
              onClick={() => {
                setActive((current) => current.filter((item) => item.id !== toast.id));
                navigate(`/app/operations/${toast.operationId}`);
              }}
              className="min-w-0 flex-1 text-left focus-visible:outline-none"
            >
              <p className="text-sm font-medium text-ink">{toast.title}</p>
              <p className="mt-0.5 truncate text-sm text-ink-muted">{toast.body}</p>
            </button>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setActive((current) => current.filter((item) => item.id !== toast.id))}
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
