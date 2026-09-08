import {
  defaultNavigationPreferences,
  getNavigationPreferences,
  normalizeNavigationPreferences,
  saveNavigationPreferences,
  type NavigationPreferences,
} from '@slideops/api-client';
import { useCallback, useEffect, useRef, useState } from 'react';

/*
 * The one place the sidebar asks what this Operator has collapsed.
 *
 * The sidebar must render correctly before any answer arrives, and must keep
 * rendering correctly if no answer ever arrives: these preferences decide how
 * much of a menu is folded away, not what anyone may reach. So the first paint
 * uses this browser's copy or the built in default, the account's stored copy
 * replaces it only if the read succeeds, and every failure is swallowed.
 *
 * Starting from a value that is already right is also what keeps the sidebar
 * from jumping a beat after load, which a loading state here would guarantee.
 */

/** Where this browser keeps its copy, so a reload starts where the last one ended. */
const STORAGE_KEY = 'slideops.navigation';

/** This browser's copy, or the default. Never throws: storage can be denied. */
function readCache(): NavigationPreferences {
  if (typeof window === 'undefined') {
    return defaultNavigationPreferences();
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaultNavigationPreferences();
    }
    return normalizeNavigationPreferences(JSON.parse(raw));
  } catch {
    return defaultNavigationPreferences();
  }
}

/** Keep this browser's copy current. A refusal to store is not worth reporting. */
function writeCache(preferences: NavigationPreferences): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Storage can be full or denied. The sidebar still works for this session.
  }
}

export interface NavigationPreferencesControls {
  preferences: NavigationPreferences;
  /** Open a closed group, or close an open one. */
  toggleGroup: (key: string) => void;
  /** Reduce the sidebar to an icon rail, or restore it. */
  toggleSidebar: () => void;
}

/** This Operator's sidebar preferences, and the two ways they change them. */
export function useNavigationPreferences(): NavigationPreferencesControls {
  const [preferences, setPreferences] = useState<NavigationPreferences>(readCache);

  // What a toggle should read, without making the callbacks depend on the
  // current value and be rebuilt on every change.
  const latest = useRef(preferences);
  // A read that lands after the Operator has already collapsed something must
  // not undo it; their click is newer than the request that was in flight.
  const chosen = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    void getNavigationPreferences(controller.signal)
      .then((stored) => {
        if (chosen.current) {
          return;
        }
        latest.current = stored;
        setPreferences(stored);
        writeCache(stored);
      })
      .catch(() => {
        // The endpoint may not exist yet, or the network may be down. Either
        // way the sidebar keeps the default and stays entirely usable.
      });
    return () => controller.abort();
  }, []);

  const apply = useCallback((next: NavigationPreferences) => {
    chosen.current = true;
    latest.current = next;
    setPreferences(next);
    writeCache(next);
    void saveNavigationPreferences(next).catch(() => {
      // Stored locally either way, so the choice survives this session and
      // this browser even when the account cannot be told about it.
    });
  }, []);

  const toggleGroup = useCallback(
    (key: string) => {
      const current = latest.current;
      const collapsed = current.collapsed_groups.includes(key)
        ? current.collapsed_groups.filter((group) => group !== key)
        : [...current.collapsed_groups, key];
      apply({ ...current, collapsed_groups: collapsed });
    },
    [apply],
  );

  const toggleSidebar = useCallback(() => {
    const current = latest.current;
    apply({ ...current, sidebar_collapsed: !current.sidebar_collapsed });
  }, [apply]);

  return { preferences, toggleGroup, toggleSidebar };
}
