import { openOperationStream } from '@slideops/api-client';
import { useEffect, type ReactNode } from 'react';
import { useAuthStore } from '../../store/auth';
import { notificationFromEvent, useNotificationsStore } from './store';
import { Toaster } from './Toaster';

/**
 * Mounts the Workspace-wide notifications feed. While the Operator is signed in
 * it subscribes to the live event stream, turns completion and verification
 * events into notifications, and, when browser push is opted in, shows a local
 * notification too. It renders the app plus the transient toasts. The Operation
 * flow opens its own stream for the terminal; this one is only for results, so
 * the two never interfere.
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const status = useAuthStore((state) => state.status);

  useEffect(() => {
    if (status !== 'authenticated') {
      return;
    }
    const store = useNotificationsStore.getState();
    store.syncPushPermission();

    const handle = openOperationStream({
      onEvent: (event) => {
        const notification = notificationFromEvent(event);
        if (!notification) {
          return;
        }
        const { push, pushEnabled, pushPermission } = useNotificationsStore.getState();
        push(notification);
        if (
          pushEnabled &&
          pushPermission === 'granted' &&
          typeof Notification !== 'undefined'
        ) {
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
    return () => handle.close();
  }, [status]);

  return (
    <>
      {children}
      <Toaster />
    </>
  );
}
