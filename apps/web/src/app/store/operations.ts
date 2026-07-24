import type { OperationEvent } from '@slideops/api-client';
import { create } from 'zustand';

/**
 * The events store keeps the accumulated event log for each Operation. It is the
 * one place where the replayed events from GET /operations/{id} and the live
 * events from the websocket meet. Both arrive in the same shape and carry a
 * monotonic `seq`, so merging is a matter of de-duplicating by seq and keeping
 * the log in order. Nothing else about an Operation is cached here; the rest is
 * read fresh, so this global state stays small.
 */

/**
 * Merge two event logs for one Operation into a single ordered, de-duplicated
 * log. Later events with the same seq replace earlier ones, so a live event that
 * restates a replayed one never doubles it. Exported for testing.
 */
export function mergeEvents(
  existing: readonly OperationEvent[],
  incoming: readonly OperationEvent[],
): OperationEvent[] {
  if (incoming.length === 0) {
    return existing.slice();
  }
  const bySeq = new Map<number, OperationEvent>();
  for (const event of existing) {
    bySeq.set(event.seq, event);
  }
  for (const event of incoming) {
    bySeq.set(event.seq, event);
  }
  return Array.from(bySeq.values()).sort((a, b) => a.seq - b.seq);
}

interface OperationsState {
  /** The ordered event log for each Operation, keyed by Operation id. */
  events: Record<string, OperationEvent[]>;
  /** Merge a batch of events (replayed or live) into an Operation's log. */
  ingest: (operationId: string, incoming: readonly OperationEvent[]) => void;
  /** Drop an Operation's cached events, for when a detail view unmounts. */
  clear: (operationId: string) => void;
}

export const useOperationsStore = create<OperationsState>((set) => ({
  events: {},
  ingest(operationId, incoming) {
    set((state) => ({
      events: {
        ...state.events,
        [operationId]: mergeEvents(state.events[operationId] ?? [], incoming),
      },
    }));
  },
  clear(operationId) {
    set((state) => {
      if (!(operationId in state.events)) {
        return state;
      }
      const next = { ...state.events };
      delete next[operationId];
      return { events: next };
    });
  },
}));
