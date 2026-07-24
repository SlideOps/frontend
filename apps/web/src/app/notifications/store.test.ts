import type { OperationEvent } from '@slideops/api-client';
import { beforeEach, describe, expect, it } from 'vitest';
import { notificationFromEvent, useNotificationsStore } from './store';

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
  it('ignores logs, steps, and status ticks', () => {
    expect(notificationFromEvent(event({ type: 'operation.log' }))).toBeNull();
    expect(notificationFromEvent(event({ type: 'operation.step' }))).toBeNull();
    expect(notificationFromEvent(event({ type: 'operation.status' }))).toBeNull();
  });

  it('turns a passed verification into a success notification', () => {
    const result = notificationFromEvent(
      event({ type: 'operation.verification', data: { passed: true }, message: 'All checks passed.' }),
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
});
