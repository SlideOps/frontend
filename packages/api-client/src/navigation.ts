import { apiRequest } from './http';

/*
 * One Operator's own navigation preferences: which sidebar groups they have
 * collapsed, what they pinned, where they have been lately, and whether the
 * sidebar is reduced to an icon rail.
 *
 * Everything here is cosmetic. None of it decides what an Operator may reach:
 * the backend authorizes every request on its own, so a preference set that is
 * missing, stale, or unreadable is never a reason to withhold a destination.
 * That is why the defaults below are part of this module rather than of the
 * sidebar, and why the read is allowed to fail without consequence.
 *
 * This is the only place in the frontend that knows the endpoint's shape. When
 * GET and PUT /me/navigation land, this file changes and nothing else does.
 */

/** The stored preferences, in the shape the backend stores them. */
export interface NavigationPreferences {
  /** Keys of the sidebar groups the Operator has closed. */
  collapsed_groups: string[];
  /** Keys of the destinations the Operator has pinned. */
  pinned: string[];
  /** Keys of the destinations the Operator opened most recently, newest first. */
  recents: string[];
  /** Whether the whole sidebar is reduced to an icon rail. */
  sidebar_collapsed: boolean;
}

/**
 * The groups that start closed for an Operator who has never chosen: none.
 *
 * Deciding for an Operator which parts of their own product are worth seeing
 * hides destinations from the one person who has not yet learned they exist,
 * and the sidebar cannot know which groups this Operator's work lives in. So
 * everything is open until they close it, and what they close is remembered.
 * Both sidebars share one stored list, which is why the admin groups are
 * prefixed: two groups named the same thing must not close each other.
 */
export const DEFAULT_COLLAPSED_GROUPS: readonly string[] = [];

/** The preferences an Operator has before they have expressed any. */
export function defaultNavigationPreferences(): NavigationPreferences {
  return {
    collapsed_groups: [...DEFAULT_COLLAPSED_GROUPS],
    pinned: [],
    recents: [],
    sidebar_collapsed: false,
  };
}

/**
 * Read a list of destination keys out of whatever the source actually holds.
 *
 * The backend may send a bare key or an object carrying one, and a value from
 * an older browser copy may be neither. Anything unrecognised is dropped rather
 * than thrown, because a preference that cannot be read is not an error worth
 * showing an Operator.
 */
function readKeys(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const keys: string[] = [];
  for (const entry of value) {
    if (typeof entry === 'string') {
      keys.push(entry);
      continue;
    }
    if (entry !== null && typeof entry === 'object') {
      const key = (entry as Record<string, unknown>).key;
      if (typeof key === 'string') {
        keys.push(key);
      }
    }
  }
  return keys;
}

/**
 * Turn anything at all into a usable preference set, falling back field by
 * field. A partial or unexpected payload still yields a sidebar, which is the
 * whole point: preferences are decoration on top of navigation that works.
 */
export function normalizeNavigationPreferences(value: unknown): NavigationPreferences {
  const defaults = defaultNavigationPreferences();
  if (value === null || typeof value !== 'object') {
    return defaults;
  }
  const source = value as Record<string, unknown>;
  return {
    collapsed_groups: Array.isArray(source.collapsed_groups)
      ? readKeys(source.collapsed_groups)
      : defaults.collapsed_groups,
    pinned: readKeys(source.pinned),
    recents: readKeys(source.recents),
    sidebar_collapsed: source.sidebar_collapsed === true,
  };
}

/** Read this Operator's navigation preferences. Rejects like any other read. */
export async function getNavigationPreferences(
  signal?: AbortSignal,
): Promise<NavigationPreferences> {
  const response = await apiRequest<unknown>('/me/navigation', { signal });
  return normalizeNavigationPreferences(response);
}

/** Store this Operator's navigation preferences, replacing what was there. */
export async function saveNavigationPreferences(
  preferences: NavigationPreferences,
): Promise<NavigationPreferences> {
  const response = await apiRequest<unknown>('/me/navigation', {
    method: 'PUT',
    body: preferences,
  });
  return normalizeNavigationPreferences(response);
}
