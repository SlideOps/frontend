import type { OperationEvent } from '@slideops/api-client';
import { describe, expect, it } from 'vitest';
import { mergeEvents } from './operations';

/** Build a minimal event with a given seq for ordering tests. */
function event(seq: number, message: string): OperationEvent {
  return {
    operation_id: 'op_1',
    seq,
    at: '2026-07-23T00:00:00Z',
    type: 'operation.log',
    level: 'info',
    message,
    data: {},
  };
}

describe('mergeEvents', () => {
  it('orders replayed and live events by seq', () => {
    const replayed = [event(1, 'connect'), event(2, 'backup')];
    const live = [event(3, 'harden'), event(4, 'restart')];

    const merged = mergeEvents(replayed, live);

    expect(merged.map((e) => e.seq)).toEqual([1, 2, 3, 4]);
    expect(merged.map((e) => e.message)).toEqual(['connect', 'backup', 'harden', 'restart']);
  });

  it('de-duplicates by seq so a replayed then live event never doubles', () => {
    const replayed = [event(1, 'connect'), event(2, 'backup'), event(3, 'harden')];
    // The websocket redelivers seq 3 and adds seq 4.
    const live = [event(3, 'harden'), event(4, 'restart')];

    const merged = mergeEvents(replayed, live);

    expect(merged.map((e) => e.seq)).toEqual([1, 2, 3, 4]);
    expect(merged).toHaveLength(4);
  });

  it('sorts out-of-order arrivals so a late low seq lands in place', () => {
    const merged = mergeEvents([event(5, 'verify')], [event(2, 'backup'), event(1, 'connect')]);

    expect(merged.map((e) => e.seq)).toEqual([1, 2, 5]);
  });

  it('returns a copy of the existing log when there is nothing to merge', () => {
    const existing = [event(1, 'connect')];
    const merged = mergeEvents(existing, []);

    expect(merged).toEqual(existing);
    expect(merged).not.toBe(existing);
  });
});
