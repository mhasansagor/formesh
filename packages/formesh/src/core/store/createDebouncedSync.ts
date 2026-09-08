import type {
  DebouncedSync,
  DebouncedSyncOptions,
  SyncTarget,
} from "../types/sync";
import type {
  FieldPath,
  FormValues,
  StoreListener,
  Unsubscribe,
  WatchListener,
} from "../types/store";
import { diffPaths, getAtPath, setAtPath } from "../utils/paths";
import { watchPath } from "../utils/watch";

const DEFAULT_DELAY_MS = 300;

/**
 * One debounced-sync wrapper for ANY target — a whole FormStore, a section
 * slice, or an array row's object slice (all are SyncTargets, so there is
 * deliberately no separate "array" vs "object" implementation).
 *
 * Why this exists (the gap it closes):
 *
 * - Phase 1's store commits synchronously on every `setValue` — during fast
 *   typing that is one diff+notify per keystroke hitting the parent store
 *   and every subscriber of it. With this wrapper in front, the target sees
 *   exactly ONE commit per quiet period, no matter how many writes happened.
 * - The commit itself is transactional: the whole pending batch is applied
 *   to a staged copy of the target's values and handed over via a single
 *   `setValues`, which the store turns into one diff + one notify. Multiple
 *   sections syncing through their own wrappers therefore also stop
 *   fighting over the parent on every keystroke.
 * - Reads are read-through and cached: `getValues`/`getValue` include the
 *   buffered writes, so a UI rendering from the wrapper shows what the user
 *   typed immediately — the debounce only delays the *parent commit*, not
 *   the visible state. The snapshot caching also makes the wrapper safe to
 *   hand to `useSyncExternalStore` directly.
 *
 * Semantics worth knowing:
 *
 * - Trailing-edge debounce: each buffered write restarts the timer.
 * - Last write per path wins (a Map keyed by path).
 * - `flush()` commits immediately (use on blur/submit); `cancel()` drops.
 * - Writes arriving while a flush is in flight commit straight through, so
 *   nothing triggered synchronously by the flush notification is ever lost.
 * - Wrapper subscribers hear about buffered writes immediately and about
 *   external target changes as they happen; the wrapper's own flush is NOT
 *   re-announced (it was already announced when buffered, and the values
 *   did not change at that point).
 */
export function createDebouncedSync<TValues extends FormValues = FormValues>(
  target: SyncTarget<TValues>,
  options: DebouncedSyncOptions = {},
): DebouncedSync<TValues> {
  const delay = options.delay ?? DEFAULT_DELAY_MS;

  let timer: ReturnType<typeof setTimeout> | null = null;
  let flushing = false;
  let pending = new Map<FieldPath, unknown>();
  let effectiveCache: TValues | null = null;
  const listeners = new Set<StoreListener>();

  const invalidateEffective = () => {
    effectiveCache = null;
  };

  /** Target values with the pending batch applied (read-through, cached). */
  const effectiveValues = (): TValues => {
    if (effectiveCache !== null) return effectiveCache;
    if (pending.size === 0) return target.getValues();

    let next = target.getValues() as unknown as Record<string, unknown>;
    for (const [path, value] of pending) {
      next = setAtPath(next, path, value);
    }
    effectiveCache = next as TValues;
    return effectiveCache;
  };

  const notify = (changedPaths: readonly FieldPath[]) => {
    if (changedPaths.length === 0) return;
    for (const listener of listeners) {
      listener(changedPaths);
    }
  };

  const cancel = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    pending = new Map();
    invalidateEffective();
  };

  const flush = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (flushing || pending.size === 0) return;

    flushing = true;
    const batch = pending;
    pending = new Map();
    invalidateEffective();
    try {
      // Apply the whole batch onto a staged copy of the target's CURRENT
      // values, then hand the complete object over in one `setValues`. For
      // a store target that is one commit; for a section target it is one
      // `store.setValue(sectionKey, ...)` — one commit either way.
      let staged = target.getValues() as unknown as Record<string, unknown>;
      for (const [path, value] of batch) {
        staged = setAtPath(staged, path, value);
      }
      target.setValues(staged as Partial<TValues>);
    } finally {
      flushing = false;
    }
  };

  const schedule = () => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      flush();
    }, delay);
  };

  const bufferWrite = (path: FieldPath, value: unknown) => {
    if (flushing) {
      // A write arriving mid-flush (e.g. from a listener triggered by the
      // flush notification) must not join the batch already being applied.
      // Commit it straight through so it can never be dropped.
      target.setValue(path, value);
      return;
    }
    const before = effectiveValues();
    pending.set(path, value);
    invalidateEffective();
    notify(diffPaths(before, effectiveValues()));
    schedule();
  };

  const setValues = (partial: Partial<TValues>) => {
    const keys = Object.keys(partial);
    if (keys.length === 0) return;

    if (flushing) {
      target.setValues(partial);
      return;
    }

    const before = effectiveValues();
    for (const key of keys) {
      pending.set(key, (partial as Record<string, unknown>)[key]);
    }
    invalidateEffective();
    notify(diffPaths(before, effectiveValues()));
    schedule();
  };

  const subscribe = (listener: StoreListener): Unsubscribe => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  // Forward changes that happen behind our back (external writes, resets —
  // anything that is not this wrapper's own flush, which was already
  // announced when it was buffered).
  target.subscribe((changedPaths) => {
    invalidateEffective();
    if (flushing) return;
    notify(changedPaths);
  });

  const watch = (path: FieldPath, listener: WatchListener): Unsubscribe =>
    watchPath(
      subscribe,
      () => getAtPath(effectiveValues(), path),
      path,
      listener,
    );

  return {
    delay,

    get pendingCount() {
      return pending.size;
    },

    getValues: () => effectiveValues(),

    getValue: (path) => getAtPath(effectiveValues(), path),

    setValue: (path, value) => bufferWrite(path, value),

    setValues,

    reset: (nextInitialValues) => {
      cancel();
      target.reset(nextInitialValues);
    },

    // Baseline semantics, delegated straight through: what `reset()` on
    // this wrapper restores to is whatever the wrapped target considers
    // its initial values. Buffered writes are intentionally excluded —
    // they are uncommitted edits, not a new baseline.
    getInitialValues: () => target.getInitialValues(),

    subscribe,

    watch,

    flush: () => flush(),

    cancel: () => cancel(),
  };
}