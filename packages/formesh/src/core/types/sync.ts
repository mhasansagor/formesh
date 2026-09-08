import type { FieldPath, FormValues, StoreListener, Unsubscribe, WatchListener } from "./store";

/**
 * The minimal read/write/subscribe surface `createDebouncedSync` (and the
 * React hooks) need from whatever sits behind them.
 *
 * `FormStore`, `FormSection`, and `DebouncedSync` all satisfy this
 * structurally — which is the whole point: there is exactly ONE
 * debounced-sync wrapper, and whether it fronts a whole store, a section
 * slice, or (via `createFormSection`) an array row's object slice is
 * decided by the target handed to it, not by a second implementation.
 * The same surface is what lets a wrapper be handed straight to
 * `useForm`/`useFormField`/`useWatch` or wrapped in another
 * `createDebouncedSync`.
 *
 * Members are declared with method syntax (see the note on `FormStore`
 * for why — property-syntax function members break structural
 * assignability of typed targets under `strictFunctionTypes`).
 */
export interface SyncTarget<TValues extends FormValues = FormValues> {
  getValues(): TValues;
  getValue(path: FieldPath): unknown;
  setValue(path: FieldPath, value: unknown): void;
  setValues(partial: Partial<TValues>): void;
  reset(nextInitialValues?: TValues): void;
  /** The committed baseline (what `reset()` restores to), never buffered writes. */
  getInitialValues(): TValues;
  subscribe(listener: StoreListener): Unsubscribe;
  /**
   * Observes one path (including its subtree) across changes, firing the
   * listener only when the value actually changed (deep equality). Present
   * on all implementations (store, section, debounced sync), so `useWatch`
   * and derived-field logic compose against any target the same way.
   */
  watch(path: FieldPath, listener: WatchListener): Unsubscribe;
}

export interface DebouncedSyncOptions {
  /**
   * Milliseconds to wait after the last buffered write before committing to
   * the target (trailing-edge debounce). Defaults to 300ms.
   */
  delay?: number;
}

/**
 * A buffering layer in front of any SyncTarget. Writes land in a pending
 * batch and commit to the target in ONE transactional write after `delay`
 * ms of quiet; reads see the buffered writes immediately (read-through),
 * so a UI rendering from the wrapper never lags behind typing even though
 * the parent store updates on the debounce.
 *
 * It deliberately exposes the same surface shape as its target (members in
 * method syntax, see `SyncTarget`), so it can itself be wrapped, watched,
 * composed, and handed to the React hooks the same way.
 */
export interface DebouncedSync<TValues extends FormValues = FormValues> {
  /** The configured debounce delay in milliseconds. */
  readonly delay: number;
  /** How many writes are currently buffered and not yet committed. */
  readonly pendingCount: number;

  /**
   * Current values including any buffered-but-uncommitted writes. The
   * returned snapshot is cached between changes, making it safe as a
   * `useSyncExternalStore` getSnapshot.
   */
  getValues(): TValues;

  /** Reads a single value by path, including buffered writes. */
  getValue(path: FieldPath): unknown;

  /** Buffers a single write and (re)schedules the debounced commit. */
  setValue(path: FieldPath, value: unknown): void;

  /** Buffers a partial merge (same shallow-merge semantics as the target). */
  setValues(partial: Partial<TValues>): void;

  /** Drops all pending writes and forwards the reset to the target. */
  reset(nextInitialValues?: TValues): void;

  /**
   * The target's committed baseline (what `reset()` restores to),
   * delegated straight through to the wrapped target. Buffered writes are
   * deliberately NOT part of the baseline — they are uncommitted edits.
   */
  getInitialValues(): TValues;

  /**
   * Subscribes to changes. Listeners fire immediately when writes are
   * buffered (with the read-through changed paths) and when the target
   * changes for reasons other than this wrapper's own flush.
   */
  subscribe(listener: StoreListener): Unsubscribe;

  /** Observes one path (read-through) across buffered and committed changes. */
  watch(path: FieldPath, listener: WatchListener): Unsubscribe;

  /** Commits everything buffered right now and clears the timer. */
  flush(): void;

  /** Drops everything buffered and clears the timer. Target is untouched. */
  cancel(): void;
}