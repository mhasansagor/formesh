import { useEffect, useRef } from "react";
import type { WatchListener } from "../../core/types/store";
import type { SyncTarget } from "../../core/types/sync";

/**
 * Runs `listener(value, previousValue)` whenever the value at `path`
 * actually changes (deep equality). This is the React entry to the store's
 * `watch` primitive — the primitive derived fields (`qty × price =
 * lineTotal`) and cascading selects (`Country` change clears `City`) are
 * built on.
 *
 * The listener identity may change every render (it usually closes over
 * props/state); the effect only re-subscribes when `target` or `path`
 * changes, and always invokes the latest listener via a ref — so handlers
 * never see stale closures, and no subscription churn happens per render.
 *
 * The listener does not fire on mount. Initial derivations belong in
 * render (read the value directly) or in the code that sets up the form.
 */
export function useWatch(
  target: SyncTarget,
  path: string,
  listener: WatchListener,
): void {
  const listenerRef = useRef(listener);
  listenerRef.current = listener;

  useEffect(() => {
    return target.watch(path, (value, previousValue) =>
      listenerRef.current(value, previousValue),
    );
  }, [target, path]);
}