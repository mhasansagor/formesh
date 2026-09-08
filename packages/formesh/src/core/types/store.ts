/**
 * A form's values are always a plain, serializable-shaped JS object.
 * Nesting is allowed (and is how multi-section forms compose), but every
 * leaf is a value the consumer owns — the store never wraps values in
 * framework-specific containers.
 */
export type FormValues = Record<string, unknown>;

/**
 * A dot-separated path into a (possibly nested) FormValues object.
 * e.g. "employeeInfo.firstName"
 *
 * Kept as a plain `string` (not a template-literal-typed path) in Phase 1.
 * Full compile-time path inference is a Phase 6 (DX) concern — see the
 * project roadmap's note on avoiding excessive type complexity before the
 * runtime behavior it would describe actually exists.
 */
export type FieldPath = string;

/**
 * A listener is notified after a change with the fields that actually
 * changed (as dot-paths), so subscribers can decide for themselves whether
 * a change is relevant to them. The store computes this list; individual
 * hooks decide what to do with it (this is what makes fine-grained
 * subscription possible without the store knowing about React).
 */
export type StoreListener = (changedPaths: readonly FieldPath[]) => void;

export type Unsubscribe = () => void;

/**
 * Callback for `watch(path, listener)`. Fires only when the value at the
 * watched path actually changed (by deep equality, matching `deepEqual`),
 * receiving the new value and the value immediately before the change. It
 * deliberately does NOT fire on subscribe — consumers who need an initial
 * derivation can compute it during render from `getValues()`.
 */
export type WatchListener = (value: unknown, previousValue: unknown) => void;

export interface FormStore<TValues extends FormValues = FormValues> {
  /**
   * Returns the current values object. Never mutated in place.
   *
   * NOTE: the members of this interface are deliberately declared with
   * *method syntax* (`getValues()`, not `getValues: () => ...`). Under
   * `strictFunctionTypes`, property-syntax function members are checked
   * contravariantly, which makes `FormStore<SomeTypedShape>` NOT assignable
   * to `FormStore<FormValues>` — silently breaking every composition that
   * hands a typed store/section/sync wrapper to something expecting the
   * loose `FormValues` shape (hooks, `createFormSection`,
   * `createDebouncedSync`). Method syntax restores bivariance for these
   * members, which is exactly what the structural composability story
   * (store → section → debounced sync → React hooks) relies on.
   */
  getValues(): TValues;

  /** Reads a single value by dot-path. Returns `undefined` if not present. */
  getValue(path: FieldPath): unknown;

  /** Writes a single value by dot-path, notifying relevant subscribers. */
  setValue(path: FieldPath, value: unknown): void;

  /**
   * Merges a partial values object into the store (shallow per top-level
   * key, matching how independent sections merge into a parent form).
   */
  setValues(partial: Partial<TValues>): void;

  /** Restores the store to its initial values (or a new baseline, if given). */
  reset(nextInitialValues?: TValues): void;

  /**
   * Subscribes to store changes. The listener fires after every commit with
   * the list of dot-paths that changed. Returns an unsubscribe function.
   */
  subscribe(listener: StoreListener): Unsubscribe;

  /**
   * Observes one path (including its whole subtree) across commits,
   * invoking `listener(value, previousValue)` only when the value actually
   * changed (deep equality). Returns an unsubscribe function.
   */
  watch(path: FieldPath, listener: WatchListener): Unsubscribe;

  /** The values the store was created with, or last reset to. */
  getInitialValues(): TValues;
}
