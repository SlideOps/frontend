import type { OperationEvent } from '@slideops/api-client';
import { create } from 'zustand';

/*
 * Notifications surface the results of Operations as they happen. They are fed
 * by the same live event stream that drives the terminal, so completion and
 * verification results reach the Operator without a refresh. The pure
 * notificationFromEvent decides which events become a notification and what it
 * says; the store holds the list, the unread count, and the browser-push
 * opt-in. Keeping the decision pure makes the behavior easy to test.
 */

export type NotificationTone = 'success' | 'danger' | 'info';

export interface AppNotification {
  /** Stable id from the Operation and event seq, so a replayed event never doubles. */
  id: string;
  operationId: string;
  kind: 'completion' | 'verification' | 'action_required';
  tone: NotificationTone;
  title: string;
  body: string;
  at: string;
  read: boolean;
  /** Where the Operator should go to act, when the notification asks for one. */
  href?: string;
  /** A notification that waits until it is acted on rather than easing away. */
  persistent?: boolean;
}

/** Read a string field from an event's open data bag, or undefined. */
function readString(data: Record<string, unknown>, key: string): string | undefined {
  const value = data[key];
  return typeof value === 'string' ? value : undefined;
}

/**
 * Turn one Operation event into a notification, or null when the event is not
 * one an Operator needs to be told about. Completion, verification, and the
 * awaiting_approval status become notifications; logs, steps, and every other
 * status tick do not.
 */
export function notificationFromEvent(event: OperationEvent): AppNotification | null {
  const base = {
    id: `${event.operation_id}:${event.seq}`,
    operationId: event.operation_id,
    at: event.at,
    read: false,
  };

  // A plan reaching approval is the one status tick that demands the Operator.
  // It waits on screen until acted on and links straight to the Operation.
  if (
    event.type === 'operation.status' &&
    readString(event.data, 'status') === 'awaiting_approval'
  ) {
    return {
      ...base,
      kind: 'action_required',
      tone: 'info',
      title: 'Action required',
      body: event.message || 'A plan is ready for your approval.',
      href: `/app/operations/${event.operation_id}`,
      persistent: true,
    };
  }

  if (event.type === 'operation.verification') {
    const passed = event.data.passed === true || event.level === 'info';
    const failed = event.data.passed === false || event.level === 'error';
    const tone: NotificationTone = failed ? 'danger' : passed ? 'success' : 'info';
    return {
      ...base,
      kind: 'verification',
      tone,
      title: tone === 'danger' ? 'Verification did not pass' : 'Verification passed',
      body: event.message || 'The verification result is in.',
    };
  }

  if (event.type === 'operation.completed') {
    const status = readString(event.data, 'status');
    const failed = status === 'failed' || event.level === 'error';
    const cancelled = status === 'cancelled';
    const tone: NotificationTone = failed ? 'danger' : cancelled ? 'info' : 'success';
    const title = failed
      ? 'Operation failed and was rolled back'
      : cancelled
        ? 'Operation cancelled'
        : 'Operation completed and verified';
    return {
      ...base,
      kind: 'completion',
      tone,
      title,
      body: event.message || 'The Operation finished.',
    };
  }

  return null;
}

/**
 * Whether an event means its Operation is no longer awaiting the Operator's
 * approval, so a pending action-required notification for it should be cleared.
 * It is true once the Operation is approved, running, verifying, or finished.
 */
export function isPastApproval(event: OperationEvent): boolean {
  if (event.type === 'operation.completed' || event.type === 'operation.verification') {
    return true;
  }
  if (event.type === 'operation.status') {
    const status = readString(event.data, 'status');
    return status !== undefined && status !== 'awaiting_approval';
  }
  return false;
}

export type PushPermission = 'default' | 'granted' | 'denied' | 'unsupported';

interface NotificationsState {
  items: AppNotification[];
  /** How many notifications have not been read yet. */
  unread: number;
  /** Whether browser push is turned on by the Operator and permitted. */
  pushEnabled: boolean;
  pushPermission: PushPermission;
  /** Add a notification, ignoring one whose id is already present. */
  push: (notification: AppNotification) => void;
  markAllRead: () => void;
  dismiss: (id: string) => void;
  /**
   * Clear any pending action-required notification for an Operation once it is no
   * longer awaiting approval, so a popup never lingers saying an action is needed
   * after the Operation has already been approved or has moved on.
   */
  resolveAction: (operationId: string) => void;
  clear: () => void;
  /** Reflect the current browser permission into the store. */
  syncPushPermission: () => void;
  /** Ask the browser for permission on an explicit Operator action. */
  requestPush: () => Promise<void>;
  disablePush: () => void;
}

function currentPermission(): PushPermission {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return 'unsupported';
  }
  return Notification.permission as PushPermission;
}

function unreadCount(items: AppNotification[]): number {
  return items.filter((item) => !item.read).length;
}

const MAX_ITEMS = 50;

export const useNotificationsStore = create<NotificationsState>((set) => ({
  items: [],
  unread: 0,
  pushEnabled: false,
  pushPermission: currentPermission(),
  push(notification) {
    set((state) => {
      if (state.items.some((item) => item.id === notification.id)) {
        return state;
      }
      const items = [notification, ...state.items].slice(0, MAX_ITEMS);
      return { items, unread: unreadCount(items) };
    });
  },
  markAllRead() {
    set((state) => ({
      items: state.items.map((item) => (item.read ? item : { ...item, read: true })),
      unread: 0,
    }));
  },
  dismiss(id) {
    set((state) => {
      const items = state.items.filter((item) => item.id !== id);
      return { items, unread: unreadCount(items) };
    });
  },
  resolveAction(operationId) {
    set((state) => {
      const items = state.items.filter(
        (item) => !(item.kind === 'action_required' && item.operationId === operationId),
      );
      if (items.length === state.items.length) {
        return state;
      }
      return { items, unread: unreadCount(items) };
    });
  },
  clear() {
    set({ items: [], unread: 0 });
  },
  syncPushPermission() {
    const permission = currentPermission();
    set((state) => ({
      pushPermission: permission,
      pushEnabled: permission === 'granted' ? state.pushEnabled : false,
    }));
  },
  async requestPush() {
    if (typeof window === 'undefined' || typeof Notification === 'undefined') {
      set({ pushPermission: 'unsupported', pushEnabled: false });
      return;
    }
    try {
      const result = await Notification.requestPermission();
      set({
        pushPermission: result as PushPermission,
        pushEnabled: result === 'granted',
      });
    } catch {
      // If the browser refuses the prompt, leave push off rather than surface an error.
      set({ pushEnabled: false });
    }
  },
  disablePush() {
    set({ pushEnabled: false });
  },
}));
