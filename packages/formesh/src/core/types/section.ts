import type { FieldPath, FormValues, Unsubscribe, WatchListener } from "./store";

/**
 * A section-scoped listener receives dot-paths already relative to the
 * section (the section's own key prefix is stripped before delivery).
 */
export type SectionListener = (changedPaths: readonly FieldPath[]) => void;

/**
 * Members are declared with method syntax (see the note on `FormStore` for
 * why — property-syntax function members break structural assignability of
 * typed sections under `strictFunctionTypes`).
 */
export interface FormSection<TSectionValues extends FormValues = FormValues> {
  /** The dot-path key this section is scoped to on the parent store. */
  readonly key: string;

  /** Current values for just this section, as a plain object. */
  getValues(): TSectionValues;

  /** Reads a value at a path relative to this section. */
  getValue(relativePath: FieldPath): unknown;

  /** Writes a value at a path relative to this section. */
  setValue(relativePath: FieldPath, value: unknown): void;

  /** Shallow-merges a partial object into this section's values. */
  setValues(partial: Partial<TSectionValues>): void;

  /** Resets this section back to its slice of the store's initial values. */
  reset(): void;

  /**
   * The slice of the parent store's initial values this section owns (i.e.
   * what `reset()` restores to). Present so a section satisfies the same
   * structural surface as a store — required for `SyncTarget` composition
   * (`createDebouncedSync(section)`, `useForm(section)`, ...).
   */
  getInitialValues(): TSectionValues;

  /** Subscribes to changes within this section only (paths are relative). */
  subscribe(listener: SectionListener): Unsubscribe;

  /**
   * Observes one section-relative path (including its subtree) across
   * changes, invoking `listener(value, previousValue)` only when the value
   * actually changed (deep equality). Returns an unsubscribe function.
   */
  watch(relativePath: FieldPath, listener: WatchListener): Unsubscribe;
}
