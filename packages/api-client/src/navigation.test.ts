import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  defaultNavigationPreferences,
  getNavigationPreferences,
  normalizeNavigationPreferences,
  saveNavigationPreferences,
} from './navigation';

/*
 * The sidebar reads its preferences through here and nowhere else, so this is
 * where the tolerance lives: a partial payload, an older browser copy, or a
 * shape nobody expected must still produce a sidebar rather than an exception.
 */

/** Build a Response-like stub for the mocked fetch. */
function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  } as unknown as Response;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('navigation preferences', () => {
  it('starts an Operator with every group open and nothing collapsed for them', () => {
    const preferences = defaultNavigationPreferences();

    expect(preferences.collapsed_groups).toEqual([]);
    expect(preferences.sidebar_collapsed).toBe(false);
  });

  it('falls back to the default for anything that is not a preference set', () => {
    expect(normalizeNavigationPreferences(null)).toEqual(defaultNavigationPreferences());
    expect(normalizeNavigationPreferences('nonsense')).toEqual(defaultNavigationPreferences());
  });

  it('keeps every group an Operator collapsed, and collapses nothing they did not', () => {
    expect(
      normalizeNavigationPreferences({ collapsed_groups: ['observe'] }).collapsed_groups,
    ).toEqual(['observe']);
    expect(normalizeNavigationPreferences({ collapsed_groups: [] }).collapsed_groups).toEqual([]);
    expect(normalizeNavigationPreferences({}).collapsed_groups).toEqual(
      defaultNavigationPreferences().collapsed_groups,
    );
  });

  it('reads a pinned entry whether it arrives as a key or as an object carrying one', () => {
    const preferences = normalizeNavigationPreferences({
      pinned: ['projects', { key: 'nodes' }, 42, null],
      recents: [{ key: 'reports' }],
    });

    expect(preferences.pinned).toEqual(['projects', 'nodes']);
    expect(preferences.recents).toEqual(['reports']);
  });

  it('reads and writes this Operator through the one navigation endpoint', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        collapsed_groups: ['observe'],
        pinned: [],
        recents: [],
        sidebar_collapsed: true,
      }),
    );

    const read = await getNavigationPreferences();
    expect(read.collapsed_groups).toEqual(['observe']);
    expect(read.sidebar_collapsed).toBe(true);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/v1/me/navigation');

    await saveNavigationPreferences(read);
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: 'PUT' });
  });
});
