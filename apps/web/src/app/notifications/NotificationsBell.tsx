import { cn } from '@slideops/design-system';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  BellRing,
  CheckCheck,
  CheckCircle2,
  Info,
  XCircle,
} from '@slideops/icons';
import { Guidance, Popover } from '@slideops/tooltips';
import { useNavigate } from 'react-router-dom';
import type { AppNotification, NotificationTone } from './store';
import { useNotificationsStore } from './store';

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

/** A pending action reads with its own warning-toned mark; other results follow their tone. */
function notificationIcon(item: AppNotification): { Icon: typeof CheckCircle2; color: string } {
  if (item.kind === 'action_required') {
    return { Icon: AlertTriangle, color: 'text-warning' };
  }
  return { Icon: toneIcon[item.tone], color: toneColor[item.tone] };
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) {
    return '';
  }
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 60) {
    return 'just now';
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  return new Date(iso).toLocaleDateString();
}

/** The browser-push opt-in row, shown inside the notifications panel. */
function PushOptIn() {
  const permission = useNotificationsStore((state) => state.pushPermission);
  const enabled = useNotificationsStore((state) => state.pushEnabled);
  const requestPush = useNotificationsStore((state) => state.requestPush);
  const disablePush = useNotificationsStore((state) => state.disablePush);

  if (permission === 'unsupported') {
    return null;
  }

  return (
    <div className="mt-2 flex items-start gap-2 border-t border-border pt-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <p className="text-sm font-medium text-ink">Browser notifications</p>
          <Guidance for="notifications.push" size={14} />
        </div>
        <p className="mt-0.5 text-xs text-ink-muted">
          {enabled
            ? 'On. You will be notified when an Operation completes.'
            : permission === 'denied'
              ? 'Blocked in your browser settings.'
              : 'Get notified when an Operation completes.'}
        </p>
      </div>
      {enabled ? (
        <button
          type="button"
          onClick={disablePush}
          className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-ink-muted transition-colors duration-fast ease-standard hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          Turn off
        </button>
      ) : (
        <button
          type="button"
          disabled={permission === 'denied'}
          onClick={() => void requestPush()}
          className="shrink-0 rounded-md bg-brand px-2 py-1 text-xs font-medium text-brand-fg transition-colors duration-fast ease-standard hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50"
        >
          Turn on
        </button>
      )}
    </div>
  );
}

/**
 * The notifications control in the app header: a bell with an unread count that
 * opens a panel of recent Operation results and the browser-push opt-in. Each
 * result links to its Operation. This is the in-app home for the live results
 * feed the stream provides.
 */
export function NotificationsBell() {
  const navigate = useNavigate();
  const items = useNotificationsStore((state) => state.items);
  const unread = useNotificationsStore((state) => state.unread);
  const markAllRead = useNotificationsStore((state) => state.markAllRead);

  return (
    <Popover
      label="Notifications"
      placement="bottom"
      trigger={(props) => (
        <button
          type="button"
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-muted transition-colors duration-fast ease-standard hover:bg-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          {...props}
        >
          {unread > 0 ? (
            <BellRing width={18} height={18} aria-hidden />
          ) : (
            <Bell width={18} height={18} aria-hidden />
          )}
          {unread > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-pill bg-brand px-1 text-[10px] font-semibold text-brand-fg">
              {unread > 9 ? '9+' : unread}
            </span>
          ) : null}
        </button>
      )}
    >
      <div className="w-72">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <p className="text-sm font-semibold text-ink">Notifications</p>
            <Guidance for="notifications.center" size={14} />
          </div>
          {items.length > 0 && unread > 0 ? (
            <button
              type="button"
              onClick={markAllRead}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-ink-muted transition-colors duration-fast ease-standard hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              <CheckCheck width={14} height={14} aria-hidden />
              Mark all read
            </button>
          ) : null}
        </div>

        {items.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">
            No notifications yet. Results from your Operations will appear here.
          </p>
        ) : (
          <ul className="mt-2 flex max-h-80 flex-col divide-y divide-border overflow-y-auto">
            {items.slice(0, 12).map((item) => {
              const { Icon, color } = notificationIcon(item);
              const target = item.href ?? `/app/operations/${item.operationId}`;
              const pending = item.kind === 'action_required';
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => navigate(target)}
                    className={cn(
                      'flex w-full items-start gap-2 py-2 text-left transition-colors duration-fast ease-standard hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
                      item.read ? undefined : 'font-medium',
                    )}
                  >
                    <Icon
                      width={16}
                      height={16}
                      className={cn('mt-0.5 shrink-0', color)}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-ink">{item.title}</span>
                      <span className="mt-0.5 block truncate text-xs text-ink-muted">
                        {item.body}
                      </span>
                      <span className="mt-0.5 flex items-center gap-2">
                        <span className="text-[11px] text-ink-muted">{relativeTime(item.at)}</span>
                        {pending ? (
                          <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-warning">
                            Review
                            <ArrowRight width={12} height={12} aria-hidden />
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <PushOptIn />
      </div>
    </Popover>
  );
}
