import { useCallback, useSyncExternalStore } from "react";
import type { SyncTarget } from "../../core/types/sync";
import { defaultNormalize } from "../../core/utils/normalize";
import type { FieldOptions, Normalizer, RegisteredField } from "../../core/types/field";

/**
 * Subscribes a component to exactly one field path.
 *
 * The target may be a FormStore, a FormSection, or a DebouncedSync wrapper
 * — anything satisfying the shared structural SyncTarget surface, which is
 * what lets debounced buffering compose into per-field subscriptions.
 *
 * The subscribe callback here ignores the changed-paths list and always
 * asks React to re-check — but `useSyncExternalStore` only actually
 * re-renders the component when `getSnapshot()`'s return value differs
 * (via `Object.is`) from the last one. Because the store only clones
 * objects along the path that changed (see `setAtPath`), an update to an
 * unrelated field leaves this field's value referentially identical, so
 * React bails out without rendering.
 *
 * This is the primitive to reach for when a form is large enough that
 * isolating re-renders per field (rather than per section, via `useForm`)
 * actually matters — e.g. a field array with hundreds of rows.
 */
export function useFormField<TValue = unknown>(
  target: SyncTarget,
  path: string,
  options: FieldOptions<TValue> = {},
): RegisteredField<TValue> {
  const getSnapshot = useCallback(() => target.getValue(path), [target, path]);
  const subscribe = useCallback(
    (onChange: () => void) => target.subscribe(() => onChange()),
    [target, path],
  );

  const rawValue = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const value = (rawValue === undefined ? options.defaultValue : rawValue) as TValue;

  const normalize: Normalizer<TValue> =
    options.normalize ?? (defaultNormalize as unknown as Normalizer<TValue>);

  return {
    name: path,
    value,
    onChange: (input: unknown) => {
      target.setValue(path, normalize(input, { path }));
    },
    onBlur: () => {
      // Touched-state for a field observed in isolation is tracked by the
      // caller if needed (e.g. local `useState`) — `useForm`'s shared
      // `touched` map is a whole-scope concern by design; duplicating a
      // second touched-tracking mechanism here would be exactly the kind
      // of speculative feature the roadmap says to avoid until a real case
      // needs it.
    },
  };
}
