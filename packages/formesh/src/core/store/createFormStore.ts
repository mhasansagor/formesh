import type {
  FieldPath,
  FormStore,
  FormValues,
  StoreListener,
  Unsubscribe,
} from "../types/store";
import { diffPaths, getAtPath, mergeAtRoot, setAtPath } from "../utils/paths";
import { watchPath } from "../utils/watch";

/**
 * Creates a framework-agnostic form store.
 *
 * This file must never import React. It's the piece every other package
 * (react, validators, file, array) builds on top of, and it needs to stay
 * independently unit-testable and usable outside React entirely (see
 * roadmap section 7).
 *
 * Design notes (documented here because the "why" matters for anyone
 * extending this later):
 *
 * - Values are plain objects, updated immutably (see `paths.ts`), so
 *   `getValues()` always returns a plain, serializable snapshot — no
 *   proxies, no framework-specific wrappers.
 * - The store does not itself decide who re-renders. It just computes
 *   *which dot-paths changed* on every commit and hands that list to every
 *   subscriber. The React binding (`useForm`, in the `react` entry point)
 *   is what turns "did my path change?" into a re-render decision, via
 *   `useSyncExternalStore`. This split is what avoids a Context-based
 *   design, where every consumer re-renders on every change regardless of
 *   which field they read.
 */
export function createFormStore<TValues extends FormValues = FormValues>(
  initialValues: TValues,
): FormStore<TValues> {
  let initial = initialValues;
  let values = initialValues;
  const listeners = new Set<StoreListener>();

  const subscribe = (listener: StoreListener): Unsubscribe => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  const notify = (changedPaths: readonly FieldPath[]) => {
    if (changedPaths.length === 0) return;
    for (const listener of listeners) {
      listener(changedPaths);
    }
  };

  const commit = (nextValues: TValues) => {
    if (Object.is(values, nextValues)) return;
    const changed = diffPaths(values, nextValues);
    values = nextValues;
    notify(changed);
  };

  return {
    getValues: () => values,

    getValue: (path) => getAtPath(values, path),

    setValue: (path, value) => {
      commit(setAtPath(values, path, value));
    },

    setValues: (partial) => {
      commit(mergeAtRoot(values, partial));
    },

    reset: (nextInitialValues) => {
      const baseline = nextInitialValues ?? initial;
      initial = baseline;
      commit(baseline);
    },

    subscribe,

    /**
     * Observes one path (including its whole subtree) across commits. The
     * listener fires only when the value at `path` actually changed (deep
     * equality — an ancestor being replaced with identical leaf values does
     * not count). This is the primitive derived fields and cascading
     * selects are built on: `watch("qty", ...)` / `watch("country", ...)`.
     * It does not fire on subscribe; compute initial derivations during
     * render from `getValues()` instead.
     */
    watch: (path, listener) =>
      watchPath(
        subscribe,
        () => getAtPath(values, path),
        path,
        listener,
      ),

    getInitialValues: () => initial,
  };
}
