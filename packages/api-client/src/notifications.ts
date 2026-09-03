import { apiRequest } from './http';

/*
 * The Operator's durable in-app notification inbox. It is separate from an
 * Operation's own live event stream: an Operation's events are about one
 * running change and do not need to survive past it, while a notification is
 * about something the Operator needs to see even if they were offline when
 * it happened, a workspace invitation being the first case. It persists
 * across sessions and devices. Field names mirror the backend contract
 * exactly so the wire shape and the type never drift.
 */

/** One entry in the notification inbox. type is a stable, dotted slug (for
 * example "workspace.invited") so the bell can pick an icon without parsing
 * the title. link is where the notification opens when read, empty when
 * there is nowhere more specific to send the Operator. */
export interface InboxNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  link?: string;
  read: boolean;
  created_at: string;
}

/** The inbox read: the notifications, newest first, and the unread count
 * together, so a bell badge never needs a second request. */
export interface NotificationInbox {
  notifications: InboxNotification[];
  unread_count: number;
}

/** Read the notification inbox and the unread count together. */
export function listNotifications(signal?: AbortSignal): Promise<NotificationInbox> {
  return apiRequest<NotificationInbox>('/notifications', { signal });
}

/** Read the unread count alone, cheap enough to poll for the bell badge
 * without fetching the whole inbox. */
export function unreadNotificationCount(signal?: AbortSignal): Promise<number> {
  return apiRequest<{ unread_count: number }>('/notifications/unread-count', { signal }).then(
    (r) => r.unread_count,
  );
}

/** Mark one notification read. A notification that does not exist, or is not
 * yours, is a no-op rather than an error. */
export function markNotificationRead(id: string): Promise<void> {
  return apiRequest<void>(`/notifications/${id}/read`, { method: 'POST' });
}

/** Mark every notification read in one action. */
export function markAllNotificationsRead(): Promise<void> {
  return apiRequest<void>('/notifications/read-all', { method: 'POST' });
}
