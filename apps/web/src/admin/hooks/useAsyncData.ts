import { ApiError } from '@slideops/api-client';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * A small data-loading hook. It runs an async loader, tracks loading, error, and
 * ready states, cancels a request in flight when its inputs change, and offers a
 * reload for actions that mutate what the screen shows. Screens use it so each one
 * reads the same way and no request outlives its screen.
 *
 * **A refresh keeps what is already on screen.** This used to throw the data away
 * and drop back to `loading`, so every small action -- saving a setting, toggling
 * a Plugin, deleting one row, refreshing a log -- unmounted the whole section and
 * replaced it with a spinner. In a single-page app that reads as a full page
 * reload, which is exactly what a single-page app exists to avoid.
 *
 * So `reload()` now refetches underneath: `state` stays `ready` with the previous
 * data and `refreshing` goes true. A screen that wants to show activity reads
 * `refreshing`; one that does not simply never blinks. `loading` is now what it
 * says: the first load, when there is genuinely nothing to show yet.
 *
 * A refetch that fails leaves the last good data in place and reports the failure
 * through `refreshError`, because replacing a working screen with an error page
 * over one failed poll loses more than it tells.
 */

export type AsyncState<T> =
  | { status: 'loading'; data: undefined; error: undefined }
  | { status: 'error'; data: undefined; error: ApiError }
  | { status: 'ready'; data: T; error: undefined };

export interface AsyncResult<T> {
  state: AsyncState<T>;
  /** Refetch underneath, keeping what is on screen. */
  reload: () => void;
  /** True while a reload is in flight, for a quiet indicator. */
  refreshing: boolean;
  /** Why the last refresh failed, with the previous data still shown. */
  refreshError: ApiError | null;
}

const loadingState = { status: 'loading', data: undefined, error: undefined } as const;

/** Normalize anything thrown into the typed error the screens render. */
function toApiError(error: unknown): ApiError {
  return error instanceof ApiError
    ? error
    : new ApiError(0, 'unknown_error', 'This did not load. Try again.');
}

export function useAsyncData<T>(
  load: (signal: AbortSignal) => Promise<T>,
  deps: readonly unknown[],
): AsyncResult<T> {
  const [state, setState] = useState<AsyncState<T>>(loadingState);
  const [nonce, setNonce] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<ApiError | null>(null);

  const loadRef = useRef(load);
  loadRef.current = load;

  // Whether this run is an explicit refresh of the same inputs, as opposed to a
  // first load or a change of inputs. Only a refresh keeps the old data.
  const isRefresh = useRef(false);

  const reload = useCallback(() => {
    isRefresh.current = true;
    setNonce((value) => value + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const refreshing = isRefresh.current;
    isRefresh.current = false;

    let active = true;
    if (refreshing) {
      // Leave the data where it is; the screen keeps rendering while this runs.
      setRefreshing(true);
    } else {
      // The inputs changed, so the old data is for a different question. Clearing
      // is right here: showing one resource's data under another's heading would
      // be worse than a moment of loading.
      setState(loadingState);
    }
    setRefreshError(null);

    loadRef
      .current(controller.signal)
      .then((data) => {
        if (active) {
          setState({ status: 'ready', data, error: undefined });
        }
      })
      .catch((error: unknown) => {
        if (!active || controller.signal.aborted) {
          return;
        }
        if (refreshing) {
          // Keep the last good data. A failed poll should not replace a working
          // screen with an error page.
          setRefreshError(toApiError(error));
          return;
        }
        setState({ status: 'error', data: undefined, error: toApiError(error) });
      })
      .finally(() => {
        if (active && refreshing) {
          setRefreshing(false);
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [...deps, nonce]);

  return { state, reload, refreshing, refreshError };
}
