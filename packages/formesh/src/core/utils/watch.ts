import type { Unsubscribe, WatchListener } from "../types/store";
import { deepEqual } from "./deepEqual";

/**
 * Whether a change reported at `changedPath` could have affected the value
 * at `watchedPath`. Three cases matter:
 *
 *  - exact match (`changedPath === watchedPath`)
 *  - the change is *inside* the watched subtree (`employee.name` changes
 *    when watching `employee`)
 *  - the watched path sits *inside* the changed subtree — an ancestor was
 *    replaced wholesale (e.g. `store.setValue("employee", {...})`), so the
 *    value at the watched path may or may not have changed; the watcher
 *    still needs to check
 *
 * An empty changed path means "everything under here was replaced" (how a
 * section sees `store.setValue(sectionKey, {...})`), so it matches any
 * watch. An empty watched path is a whole-scope watch and matches every
 * change.
 */
export function isPathWithin(changedPath: string, watchedPath: string): boolean {
  if (changedPath === "" || watchedPath === "") return true;
  return (
    changedPath === watchedPath ||
    changedPath.startsWith(`${watchedPath}.`) ||
    watchedPath.startsWith(`${changedPath}.`)
  );
}

/**
 * Shared implementation of the `watch(path, listener)` primitive used by
 * both `FormStore` and `FormSection` (and the debounced-sync wrapper).
 *
 * The subscriber receives the changed-paths list from whatever target it
 * wraps; this helper filters to changes that could affect `path`, re-reads
 * the current value, and only invokes the listener when the value *actually
 * changed* (deep-equality, consistent with `deepEqual`) — an ancestor being
 * replaced with the same leaf values must not fire derived-field logic.
 *
 * `readValue` is a closure so the current value is always read live — this
 * file never holds a reference to the store's internals itself.
 */
export function watchPath(
  subscribe: (listener: (changedPaths: readonly string[]) => void) => Unsubscribe,
  readValue: () => unknown,
  path: string,
  listener: WatchListener,
): Unsubscribe {
  let last = readValue();

  return subscribe((changedPaths) => {
    if (!changedPaths.some((changed) => isPathWithin(changed, path))) return;

    const next = readValue();
    if (deepEqual(last, next)) {
      last = next;
      return;
    }

    const previous = last;
    last = next;
    listener(next, previous);
  });
}