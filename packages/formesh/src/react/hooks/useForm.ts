import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { FormStore, FormValues } from "../../core/types/store";
import type { SyncTarget } from "../../core/types/sync";
import type { ValidationSchema, ValidationResult } from "../../core/types/validation";
import { createFormSection } from "../../core/store/createFormSection";
import { validateValues } from "../../core/validation/validateValues";
import { defaultNormalize } from "../../core/utils/normalize";
import { deepEqual } from "../../core/utils/deepEqual";
import { getAtPath } from "../../core/utils/paths";
import type { FieldOptions, Normalizer, RegisteredField } from "../../core/types/field";

/** Shared result for the no-schema case — stable identity across renders. */
const EMPTY_VALIDATION_RESULT: ValidationResult = { errors: {}, isValid: true };

export interface UseFormOptions {
  /**
   * Scopes this hook instance to a slice of the store (e.g. "employeeInfo"),
   * mirroring how independent sections of a multi-section ERP form each own
   * a key on the parent object. Omit to work with the whole store.
   */
  section?: string;

  /**
   * Validation schema (Phase 2): per-field rules keyed by scope-relative
   * dot-path, and/or form-level validators receiving the whole values
   * object in scope (for cross-field rules like date ranges and budget
   * caps). Omit for no validation (`errors` stays `{}`, `isValid` stays
   * `true`).
   */
  validation?: ValidationSchema;
}

export interface FormApi<TValues extends FormValues = FormValues> {
  /** Current values in scope (whole store, or just this section). */
  values: TValues;

  /** Which field paths (relative to scope) have been blurred at least once. */
  touched: Record<string, boolean>;

  /**
   * Whether values in scope differ from their value when this hook instance
   * first observed them. See the in-source note on `initialRef` below for
   * the exact semantics.
   */
  isDirty: boolean;

  /**
   * Validation errors for the current values in scope, keyed by
   * scope-relative field path. Recomputed on every values change against
   * `options.validation` — and because validation runs over the values this
   * hook renders from, a DebouncedSync target yields per-keystroke errors
   * from its read-through values, not only after the debounced commit.
   * All paths are exposed regardless of touched state; gate display with
   * `touched` if you only want to show errors after a field was blurred.
   */
  errors: Record<string, string>;
  /** Whether `errors` is currently empty. Always `true` without a schema. */
  isValid: boolean;

  /**
   * Runs the validation schema against the target's CURRENT values (re-read
   * live, not the render snapshot) and returns the full result — for
   * submit-time checks or manual revalidation. Same computation
   * `errors`/`isValid` already reflect.
   */
  validate: () => ValidationResult;

  getValue: (path: string) => unknown;
  setValue: (path: string, value: unknown) => void;
  setValues: (partial: Partial<TValues>) => void;

  /**
   * Produces a `{ name, value, onChange, onBlur }` prop bag for a field,
   * normalizing whatever the input hands back via `onChange`. This is the
   * direct replacement for a hand-written `handleFieldChange` per component.
   */
  registerField: <TValue = unknown>(
    path: string,
    options?: FieldOptions<TValue>,
  ) => RegisteredField<TValue>;

  /** Resets values in scope back to baseline and clears touched state. */
  reset: () => void;
}

/**
 * React binding over the shared structural target surface — a FormStore, a
 * FormSection, or a DebouncedSync wrapper (all satisfy `SyncTarget`
 * structurally; that is what makes debounced buffering compose straight
 * into this hook).
 *
 * Subscribes via `useSyncExternalStore`, so this component re-renders on
 * any change within its scope (whole store, a section slice, or the sync
 * wrapper's read-through values). This
 * is the "whole-section" usage pattern — the direct replacement for a
 * component's local `useState` + manual sync-to-parent — where one
 * component renders many fields together, same as most existing ERP form
 * sections do today.
 *
 * For genuinely fine-grained, single-field re-render isolation (a separate
 * component per field), see `useFormField` instead — this hook intentionally
 * re-renders on any change in scope, matching how these forms are already
 * structured, rather than forcing a per-field-component rewrite to adopt it.
 */
export function useForm<TValues extends FormValues = FormValues>(
  target: SyncTarget<FormValues>,
  options: UseFormOptions = {},
): FormApi<TValues> {
  const { validation } = options;

  // `section` scoping only makes sense when the target is the whole store;
  // a section of a DebouncedSync would double-prefix paths. The cast is
  // the one place the structural surface is narrowed back to FormStore —
  // createFormSection needs the store's `watch` primitive.
  const scoped = useMemo<SyncTarget<TValues>>(() => {
    return (options.section
      ? createFormSection(target as FormStore<FormValues>, options.section)
      : target) as unknown as SyncTarget<TValues>;
  }, [target, options.section]);

  const getSnapshot = useCallback(() => scoped.getValues(), [scoped]);
  const subscribeToTarget = useCallback(
    (onStoreChange: () => void) => scoped.subscribe(() => onStoreChange()),
    [scoped],
  );

  const values = useSyncExternalStore(subscribeToTarget, getSnapshot, getSnapshot);

  // Captures the values this hook instance first saw, as the baseline for
  // `isDirty`. Recomputed whenever `scoped` itself changes (a new target,
  // or a different `section` key) so switching scopes doesn't carry over a
  // stale baseline. This is a per-hook-instance notion of "dirty since I
  // started watching," not a form-wide "dirty since the app booted" — the
  // common case in practice, since a form's baseline is whatever it loaded
  // with when the component mounted.
  const scopedRef = useRef(scoped);
  const initialRef = useRef(values);
  if (scopedRef.current !== scoped) {
    scopedRef.current = scoped;
    initialRef.current = values;
  }

  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const markTouched = useCallback((path: string) => {
    setTouched((prev) => (prev[path] ? prev : { ...prev, [path]: true }));
  }, []);

  const setValue = useCallback(
    (path: string, value: unknown) => scoped.setValue(path, value),
    [scoped],
  );

  const setValues = useCallback(
    (partial: Partial<TValues>) => scoped.setValues(partial),
    [scoped],
  );

  const reset = useCallback(() => {
    scoped.reset();
    initialRef.current = scoped.getValues();
    setTouched({});
  }, [scoped]);

  const registerField = useCallback(
    <TValue = unknown>(
      path: string,
      fieldOptions: FieldOptions<TValue> = {},
    ): RegisteredField<TValue> => {
      const normalize: Normalizer<TValue> =
        fieldOptions.normalize ?? (defaultNormalize as unknown as Normalizer<TValue>);
      const rawValue = getAtPath(values, path);
      const value = (rawValue === undefined ? fieldOptions.defaultValue : rawValue) as TValue;

      return {
        name: path,
        value,
        onChange: (input: unknown) => {
          scoped.setValue(path, normalize(input, { path }));
        },
        onBlur: () => markTouched(path),
      };
    },
    [values, scoped, markTouched],
  );

  const isDirty = useMemo(() => !deepEqual(values, initialRef.current), [values]);

  // Phase 2: validation runs on every values change, over exactly the
  // values this hook renders from — so with a DebouncedSync target, errors
  // react to read-through (buffered) values per keystroke, and with a
  // section target, schema paths are section-relative. No schema means a
  // stable empty result, so consumers can keep `errors` in dependency
  // arrays without churn.
  const { errors, isValid } = useMemo(
    () => (validation ? validateValues(values, validation) : EMPTY_VALIDATION_RESULT),
    [values, validation],
  );

  const validate = useCallback((): ValidationResult => {
    return validateValues(scoped.getValues(), validation ?? {});
  }, [scoped, validation]);

  return {
    values,
    touched,
    isDirty,
    errors,
    isValid,
    validate,
    getValue: (path: string) => getAtPath(values, path),
    setValue,
    setValues,
    registerField,
    reset,
  };
}
