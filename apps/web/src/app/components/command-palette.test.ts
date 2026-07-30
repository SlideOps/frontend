import type { SearchResults } from '@slideops/api-client';
import { describe, expect, it } from 'vitest';
import {
  flattenResults,
  initialPaletteState,
  paletteReducer,
  resultCount,
} from './command-palette';

function results(over: Partial<SearchResults> = {}): SearchResults {
  return {
    nodes: [],
    projects: [],
    capabilities: [],
    operations: [],
    ...over,
  };
}

describe('flattenResults', () => {
  it('groups results by kind in a stable order and drops empty groups', () => {
    const grouped = results({
      nodes: [{ id: 'nd_1', name: 'web-1', hostname: 'web-1.internal' }],
      capabilities: [{ key: 'secure-ssh', name: 'Secure SSH', category: 'Security' }],
    });

    const { groups, items } = flattenResults(grouped);

    expect(groups.map((g) => g.kind)).toEqual(['node', 'capability']);
    expect(items.map((i) => i.key)).toEqual(['node:nd_1', 'capability:secure-ssh']);
    expect(items[0]?.to).toBe('/app/nodes/nd_1');
    expect(items[1]?.to).toBe('/app/capabilities/secure-ssh');
  });

  it('keeps the flat list in the same reading order as the groups', () => {
    const grouped = results({
      nodes: [{ id: 'nd_1', name: 'web-1', hostname: 'web-1' }],
      operations: [
        { id: 'op_1', capability_key: 'secure-ssh', status: 'completed', node_id: 'nd_1' },
      ],
    });

    const { items } = flattenResults(grouped);

    expect(items.map((i) => i.kind)).toEqual(['node', 'operation']);
  });
});

describe('resultCount', () => {
  it('sums every group', () => {
    expect(
      resultCount(
        results({
          nodes: [{ id: 'nd_1', name: 'a', hostname: 'a' }],
          projects: [{ id: 'pr_1', name: 'p' }],
        }),
      ),
    ).toBe(2);
  });
});

describe('paletteReducer', () => {
  it('sets items and resets the active index when results arrive', () => {
    const next = paletteReducer(initialPaletteState, {
      type: 'results',
      results: results({
        nodes: [
          { id: 'nd_1', name: 'web-1', hostname: 'web-1' },
          { id: 'nd_2', name: 'web-2', hostname: 'web-2' },
        ],
      }),
    });

    expect(next.status).toBe('ready');
    expect(next.items).toHaveLength(2);
    expect(next.activeIndex).toBe(0);
  });

  it('wraps the active index when moving past either end', () => {
    const ready = paletteReducer(initialPaletteState, {
      type: 'results',
      results: results({
        nodes: [
          { id: 'nd_1', name: 'web-1', hostname: 'web-1' },
          { id: 'nd_2', name: 'web-2', hostname: 'web-2' },
        ],
      }),
    });

    const up = paletteReducer(ready, { type: 'move', delta: -1 });
    expect(up.activeIndex).toBe(1);

    const downPastEnd = paletteReducer({ ...ready, activeIndex: 1 }, { type: 'move', delta: 1 });
    expect(downPastEnd.activeIndex).toBe(0);
  });
});
