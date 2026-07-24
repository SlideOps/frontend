import type { SearchResults } from '@slideops/api-client';

/*
 * The command palette state, kept as pure functions and a reducer so the parts
 * that matter for keyboard navigation and grouping are testable without a DOM.
 * The palette displays grouped results but navigates a single flat list, so the
 * arrow keys move through every result in reading order regardless of its group.
 */

export type PaletteItemKind = 'node' | 'project' | 'capability' | 'operation';

/** One selectable result, already resolved to the route it opens. */
export interface PaletteItem {
  kind: PaletteItemKind;
  /** A key unique across the whole list, used for React keys and the active id. */
  key: string;
  label: string;
  hint?: string;
  to: string;
}

/** A titled group of results of one kind, in display order. */
export interface PaletteGroup {
  kind: PaletteItemKind;
  heading: string;
  items: PaletteItem[];
}

const GROUP_ORDER: PaletteItemKind[] = ['node', 'project', 'capability', 'operation'];

const HEADINGS: Record<PaletteItemKind, string> = {
  node: 'Nodes',
  project: 'Projects',
  capability: 'Capabilities',
  operation: 'Operations',
};

/**
 * Turn grouped search results into display groups and the parallel flat list the
 * keyboard walks. Empty groups are dropped so the palette never shows an empty
 * heading. The flat list follows the same order as the rendered groups.
 */
export function flattenResults(results: SearchResults): {
  groups: PaletteGroup[];
  items: PaletteItem[];
} {
  const byKind: Record<PaletteItemKind, PaletteItem[]> = {
    node: results.nodes.map((node) => ({
      kind: 'node',
      key: `node:${node.id}`,
      label: node.name,
      hint: node.hostname,
      to: `/app/nodes/${node.id}`,
    })),
    project: results.projects.map((project) => ({
      kind: 'project',
      key: `project:${project.id}`,
      label: project.name,
      to: `/app?project=${project.id}`,
    })),
    capability: results.capabilities.map((capability) => ({
      kind: 'capability',
      key: `capability:${capability.key}`,
      label: capability.name,
      hint: capability.category,
      to: `/app/capabilities/${capability.key}`,
    })),
    operation: results.operations.map((operation) => ({
      kind: 'operation',
      key: `operation:${operation.id}`,
      label: operation.capability_key,
      hint: operation.status.replace(/_/g, ' '),
      to: `/app/operations/${operation.id}`,
    })),
  };

  const groups: PaletteGroup[] = [];
  const items: PaletteItem[] = [];
  for (const kind of GROUP_ORDER) {
    const groupItems = byKind[kind];
    if (groupItems.length === 0) {
      continue;
    }
    groups.push({ kind, heading: HEADINGS[kind], items: groupItems });
    items.push(...groupItems);
  }
  return { groups, items };
}

/** The total number of results across every group. */
export function resultCount(results: SearchResults): number {
  return (
    results.nodes.length +
    results.projects.length +
    results.capabilities.length +
    results.operations.length
  );
}

export type PaletteStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface PaletteState {
  query: string;
  status: PaletteStatus;
  groups: PaletteGroup[];
  items: PaletteItem[];
  activeIndex: number;
}

export const emptyResults: SearchResults = {
  nodes: [],
  projects: [],
  capabilities: [],
  operations: [],
};

export const initialPaletteState: PaletteState = {
  query: '',
  status: 'idle',
  groups: [],
  items: [],
  activeIndex: 0,
};

export type PaletteAction =
  | { type: 'query'; query: string }
  | { type: 'loading' }
  | { type: 'results'; results: SearchResults }
  | { type: 'error' }
  | { type: 'move'; delta: number }
  | { type: 'reset' };

/** Wrap an index within a list length, so navigation cycles instead of sticking. */
function wrapIndex(index: number, length: number): number {
  if (length === 0) {
    return 0;
  }
  return ((index % length) + length) % length;
}

export function paletteReducer(state: PaletteState, action: PaletteAction): PaletteState {
  switch (action.type) {
    case 'query':
      return { ...state, query: action.query };
    case 'loading':
      return { ...state, status: 'loading' };
    case 'results': {
      const { groups, items } = flattenResults(action.results);
      return { ...state, status: 'ready', groups, items, activeIndex: 0 };
    }
    case 'error':
      return { ...state, status: 'error', groups: [], items: [], activeIndex: 0 };
    case 'move':
      return { ...state, activeIndex: wrapIndex(state.activeIndex + action.delta, state.items.length) };
    case 'reset':
      return initialPaletteState;
    default:
      return state;
  }
}
