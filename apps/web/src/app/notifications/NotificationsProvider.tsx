import { listNotifications, openOperationStream } from '@slideops/api-client';
import { useEffect, type ReactNode } from 'react';
import { useAuthStore } from '../../store/auth';
import {
  isPastApproval,
  notificationFromEvent,
  notificationFromInbox,
  useNotificationsStore,
} from './store';
import { Toaster } from './Toaster';

/** How often the durable inbox is polled for something new while the
 *  Operator is signed in and the tab is open, matching how other polished
 *  notification centers stay current without their own push channel. */
const INBOX_POLL_MS = 45_000;

/**
 * Mounts the Workspace-wide notifications feed. While the Operator is signed in
 * it subscribes to the live event stream, turns completion and verification
 * events into notifications, and, when browser push is opted in, shows a local
 * notification too. It also reads the durable backend inbox on load and polls
 * it, so something that happened while the Operator was offline, a workspace
 * invitation being the first case, still reaches them. It renders the app plus
 * the transient toasts. The Operation flow opens its own stream for the
 * terminal; this one is only for results, so the two never interfere.
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const status = useAuthStore((state) => state.status);

  useEffect(() => {
    if (status !== 'authenticated') {
      return;
    }
    const store = useNotificationsStore.getState();
    store.syncPushPermission();

    const syncInbox = () => {
      listNotifications()
        .then((inbox) => {
          for (const n of inbox.notifications) {
            useNotificationsStore.getState().push(notificationFromInbox(n));
          }
        })
        .catch(() => {
          // A failed sync is quietly retried on the next poll; the live event
          // stream below is not affected either way.
        });
    };
    syncInbox();
    const poll = window.setInterval(syncInbox, INBOX_POLL_MS);

    const handle = openOperationStream({
      onEvent: (event) => {
        // Once an Operation is approved or moves on, clear any pending
        // action-required popup for it, so it never lingers demanding an action
        // that is already done.
        if (isPastApproval(event)) {
          useNotificationsStore.getState().resolveAction(event.operation_id);
        }
        const notification = notificationFromEvent(event);
        if (!notification) {
          return;
        }
        const { push, pushEnabled, pushPermission } = useNotificationsStore.getState();
        push(notification);
        if (pushEnabled && pushPermission === 'granted' && typeof Notification !== 'undefined') {
          try {
            new Notification(notification.title, {
              body: notification.body,
              tag: notification.operationId,
            });
          } catch {
            // A browser that refuses the constructor should not break the stream.
          }
        }
      },
    });
    return () => {
      window.clearInterval(poll);
      handle.close();
    };
  }, [status]);

  return (
    <>
      {children}
      <Toaster />
    </>
  );
}
