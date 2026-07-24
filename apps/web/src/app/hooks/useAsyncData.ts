import { ApiError } from '@slideops/api-client';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * A small data-loading hook. It runs an async loader, tracks loading, error, and
 * ready states, cancels a request in flight when its inputs change, and offers a
 * reload for actions that mutate what the screen shows. Screens use it so each
 * one reads the same way and no request outlives its screen.
 */

export type AsyncState<T> =
  | { status: 'loading'; data: undefined; error: undefined }
  | { status: 'error'; data: undefined; error: ApiError }
  | { status: 'ready'; data: T; error: undefined };

export interface AsyncResult<T> {
  state: AsyncState<T>;
  reload: () => void;
}

const loadingState = { status: 'loading', data: undefined, error: undefined } as const;

export function useAsyncData<T>(
  load: (signal: AbortSignal) => Promise<T>,
  deps: readonly unknown[],
): AsyncResult<T> {
  const [state, setState] = useState<AsyncState<T>>(loadingState);
  const [nonce, setNonce] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  const reload = useCallback(() => {
    setState(loadingState);
    setNonce((value) => value + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setState(loadingState);
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
        const normalized =
          error instanceof ApiError
            ? error
            : new ApiError(0, 'unknown_error', 'This did not load. Try again.');
        setState({ status: 'error', data: undefined, error: normalized });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [...deps, nonce]);

  return { state, reload };
}
