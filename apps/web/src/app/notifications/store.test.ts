import type { InboxNotification, OperationEvent } from '@slideops/api-client';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  isPastApproval,
  notificationFromEvent,
  notificationFromInbox,
  useNotificationsStore,
} from './store';

/** Build an Operation event with sensible defaults for a notification test. */
function event(over: Partial<OperationEvent>): OperationEvent {
  return {
    operation_id: 'op_1',
    seq: 1,
    at: '2026-07-23T00:00:00Z',
    type: 'operation.log',
    level: 'info',
    message: '',
    data: {},
    ...over,
  };
}

describe('notificationFromEvent', () => {
  it('ignores logs, steps, and status ticks other than awaiting_approval', () => {
    expect(notificationFromEvent(event({ type: 'operation.log' }))).toBeNull();
    expect(notificationFromEvent(event({ type: 'operation.step' }))).toBeNull();
    expect(notificationFromEvent(event({ type: 'operation.status' }))).toBeNull();
    expect(
      notificationFromEvent(event({ type: 'operation.status', data: { status: 'executing' } })),
    ).toBeNull();
  });

  it('turns an awaiting_approval status into a persistent action_required notification', () => {
    const result = notificationFromEvent(
      event({
        type: 'operation.status',
        operation_id: 'op_42',
        data: { status: 'awaiting_approval' },
        message: 'The plan is ready for your approval.',
      }),
    );

    expect(result).not.toBeNull();
    expect(result?.kind).toBe('action_required');
    expect(result?.tone).toBe('info');
    expect(result?.persistent).toBe(true);
    expect(result?.href).toBe('/app/operations/op_42');
    expect(result?.body).toBe('The plan is ready for your approval.');
  });

  it('detects when an Operation has moved past awaiting approval', () => {
    expect(
      isPastApproval(event({ type: 'operation.status', data: { status: 'awaiting_approval' } })),
    ).toBe(false);
    expect(isPastApproval(event({ type: 'operation.status', data: { status: 'approved' } }))).toBe(
      true,
    );
    expect(isPastApproval(event({ type: 'operation.status', data: { status: 'executing' } }))).toBe(
      true,
    );
    expect(isPastApproval(event({ type: 'operation.completed' }))).toBe(true);
    expect(isPastApproval(event({ type: 'operation.log' }))).toBe(false);
  });

  it('resolveAction clears a pending action-required popup once the Operation advances', () => {
    const store = useNotificationsStore.getState();
    store.clear();
    const pending = notificationFromEvent(
      event({
        type: 'operation.status',
        operation_id: 'op_9',
        data: { status: 'awaiting_approval' },
      }),
    );
    store.push(pending!);
    expect(useNotificationsStore.getState().items).toHaveLength(1);

    // An unrelated Operation advancing leaves it in place.
    useNotificationsStore.getState().resolveAction('op_other');
    expect(useNotificationsStore.getState().items).toHaveLength(1);

    // The same Operation advancing clears it.
    useNotificationsStore.getState().resolveAction('op_9');
    expect(useNotificationsStore.getState().items).toHaveLength(0);
  });

  it('turns a passed verification into a success notification', () => {
    const result = notificationFromEvent(
      event({
        type: 'operation.verification',
        data: { passed: true },
        message: 'All checks passed.',
      }),
    );

    expect(result).not.toBeNull();
    expect(result?.kind).toBe('verification');
    expect(result?.tone).toBe('success');
    expect(result?.body).toBe('All checks passed.');
  });

  it('turns a failed verification into a danger notification', () => {
    const result = notificationFromEvent(
      event({ type: 'operation.verification', level: 'error', data: { passed: false } }),
    );

    expect(result?.tone).toBe('danger');
    expect(result?.title).toBe('Verification did not pass');
  });

  it('marks a completed Operation as verified success', () => {
    const result = notificationFromEvent(
      event({ type: 'operation.completed', data: { status: 'completed' }, seq: 9 }),
    );

    expect(result?.kind).toBe('completion');
    expect(result?.tone).toBe('success');
    expect(result?.id).toBe('op_1:9');
  });

  it('marks a failed completion as danger and a cancelled one as info', () => {
    const failed = notificationFromEvent(
      event({ type: 'operation.completed', data: { status: 'failed' } }),
    );
    const cancelled = notificationFromEvent(
      event({ type: 'operation.completed', data: { status: 'cancelled' } }),
    );

    expect(failed?.tone).toBe('danger');
    expect(cancelled?.tone).toBe('info');
  });
});

describe('notificationFromInbox', () => {
  function inbox(over: Partial<InboxNotification>): InboxNotification {
    return {
      id: 'n_1',
      type: 'workspace.invited',
      title: 'You were invited to Acme',
      body: 'You were invited to join Acme as member.',
      link: '/invitations/tok',
      read: false,
      created_at: '2026-07-23T00:00:00Z',
      ...over,
    };
  }

  it('carries the remote id so it can be marked read on the server too', () => {
    const result = notificationFromInbox(inbox({}));
    expect(result.id).toBe('inbox:n_1');
    expect(result.remoteId).toBe('n_1');
    expect(result.kind).toBe('inbox');
    expect(result.href).toBe('/invitations/tok');
    expect(result.read).toBe(false);
  });

  it('carries the read state the backend already reports', () => {
    const result = notificationFromInbox(inbox({ read: true }));
    expect(result.read).toBe(true);
  });

  it('has no href when the backend sent no link', () => {
    const result = notificationFromInbox(inbox({ link: '' }));
    expect(result.href).toBeUndefined();
  });
});

describe('useNotificationsStore', () => {
  beforeEach(() => {
    useNotificationsStore.getState().clear();
  });

  it('adds notifications newest first and counts the unread', () => {
    const store = useNotificationsStore.getState();
    const first = notificationFromEvent(
      event({ type: 'operation.completed', seq: 1, data: { status: 'completed' } }),
    );
    const second = notificationFromEvent(
      event({ type: 'operation.completed', seq: 2, data: { status: 'failed' } }),
    );

    store.push(first!);
    store.push(second!);

    const state = useNotificationsStore.getState();
    expect(state.items.map((item) => item.id)).toEqual(['op_1:2', 'op_1:1']);
    expect(state.unread).toBe(2);
  });

  it('ignores a duplicate id so a replayed event never doubles', () => {
    const store = useNotificationsStore.getState();
    const note = notificationFromEvent(
      event({ type: 'operation.completed', seq: 3, data: { status: 'completed' } }),
    );

    store.push(note!);
    store.push(note!);

    expect(useNotificationsStore.getState().items).toHaveLength(1);
  });

  it('clears the unread count when all are marked read', () => {
    const store = useNotificationsStore.getState();
    store.push(notificationFromEvent(event({ type: 'operation.completed', seq: 4 }))!);

    useNotificationsStore.getState().markAllRead();

    expect(useNotificationsStore.getState().unread).toBe(0);
  });

  it('marks exactly one notification read by id, leaving the rest untouched', () => {
    const store = useNotificationsStore.getState();
    const first = notificationFromInbox({
      id: 'n_1',
      type: 't',
      title: 'one',
      body: '',
      link: '',
      read: false,
      created_at: '2026-07-23T00:00:00Z',
    });
    const second = notificationFromInbox({
      id: 'n_2',
      type: 't',
      title: 'two',
      body: '',
      link: '',
      read: false,
      created_at: '2026-07-23T00:00:01Z',
    });
    store.push(first);
    store.push(second);
    expect(useNotificationsStore.getState().unread).toBe(2);

    useNotificationsStore.getState().markOneRead(first.id);

    const state = useNotificationsStore.getState();
    expect(state.unread).toBe(1);
    expect(state.items.find((item) => item.id === first.id)?.read).toBe(true);
    expect(state.items.find((item) => item.id === second.id)?.read).toBe(false);
  });
});
