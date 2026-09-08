import { useEffect, useMemo } from "react";
import type { FormValues } from "../../core/types/store";
import type { DebouncedSync, SyncTarget } from "../../core/types/sync";
import { createDebouncedSync } from "../../core/store/createDebouncedSync";

export interface UseDebouncedSyncOptions {
  /**
   * Milliseconds to wait after the last buffered write before committing to
   * the target. Defaults to 300ms.
   */
  delay?: number;

  /**
   * What happens to buffered-but-uncommitted writes when the component
   * unmounts. Defaults to `true` (flush) so the last keystrokes before a
   * navigation are never lost — the exact failure mode debounced sync
   * would otherwise introduce. Set to `false` (cancel) when unmounting
   * means "abandon this edit" rather than "the form went away".
   */
  flushOnUnmount?: boolean;
}

/**
 * React binding over `createDebouncedSync`. The wrapper is memoized on
 * `[target, delay]`, so passing it to `useForm`/`useFormField` (it exposes
 * the same read/write/subscribe surface they expect) or rendering from its
 * read-through values stays referentially stable across re-renders.
 */
export function useDebouncedSync<TValues extends FormValues = FormValues>(
  target: SyncTarget<TValues>,
  options: UseDebouncedSyncOptions = {},
): DebouncedSync<TValues> {
  const { delay, flushOnUnmount = true } = options;

  const sync = useMemo(
    () => createDebouncedSync(target, delay === undefined ? {} : { delay }),
    [target, delay],
  );

  useEffect(() => {
    return () => {
      if (flushOnUnmount) {
        sync.flush();
      } else {
        sync.cancel();
      }
    };
  }, [sync, flushOnUnmount]);

  return sync;
}