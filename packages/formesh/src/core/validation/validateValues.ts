import type {
  FormLevelValidator,
  ValidationSchema,
  ValidationResult,
  Validator,
} from "../types/validation";
import type { FormValues } from "../types/store";
import { getAtPath } from "../utils/paths";

/**
 * Runs a validation schema against a values object and returns every
 * error, keyed by field path.
 *
 * Framework-agnostic and pure: no store, no React, no timers. `useForm`
 * calls this on every values change; anything else (a submit handler, a
 * draft-save guard, a section component) can call it directly with the
 * same schema.
 *
 * Semantics:
 * - Field rules run first, per path, in schema key order; the first
 *   failing rule's message wins for that path.
 * - Form-level validators run after, and their errors only fill paths
 *   that don't already have a field-level error (the per-field message is
 *   the more specific one).
 * - Nested paths ("employee.firstName") are resolved with `getAtPath`,
 *   consistent with how the store reads values.
 */
export function validateValues<TValues extends FormValues = FormValues>(
  values: TValues,
  schema: ValidationSchema,
): ValidationResult {
  const errors: Record<string, string> = {};

  const fields = schema.fields ?? {};
  for (const path of Object.keys(fields)) {
    const rules = fields[path];
    if (!rules) continue;
    const list: readonly Validator[] = Array.isArray(rules) ? rules : [rules];
    const value = getAtPath(values, path);
    for (const rule of list) {
      const error = rule(value, { path, values });
      if (error) {
        errors[path] = error;
        break;
      }
    }
  }

  const formRules = schema.form;
  if (formRules) {
    const list: readonly FormLevelValidator[] = Array.isArray(formRules)
      ? formRules
      : [formRules];
    for (const rule of list) {
      const formErrors = rule(values);
      if (!formErrors) continue;
      for (const path of Object.keys(formErrors)) {
        const message = formErrors[path];
        if (message && errors[path] === undefined) {
          errors[path] = message;
        }
      }
    }
  }

  return { errors, isValid: Object.keys(errors).length === 0 };
}