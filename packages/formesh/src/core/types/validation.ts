import type { FieldPath, FormValues } from "./store";

/**
 * Context handed to every validator alongside the value being checked.
 * `values` is the complete values object in scope (whole store or section),
 * which is what cross-field rules compare against — e.g. `matches`
 * (confirm-password) or a form-level date-range check.
 */
export interface ValidationContext {
  /** The dot-path of the field being validated (scope-relative). */
  path: FieldPath;
  /** The complete values object in scope at validation time. */
  values: FormValues;
}

/**
 * A validator returns an error message string when the value is invalid,
 * and `undefined`/`null`/nothing when it is valid. Pure functions of
 * (value, context) — no side effects, no async (debounced async validation
 * is a later-phase concern built on top of this).
 */
export type Validator = (
  value: unknown,
  context: ValidationContext,
) => string | null | undefined | void;

/** One field's rules: a single validator or a list (first failure wins). */
export type FieldRules = Validator | readonly Validator[];

/**
 * A form-level validator receives the whole values object in scope and
 * returns a partial errors map (paths → messages) — for rules no single
 * field can express: date ranges, start ≤ end, budget caps, etc.
 */
export type FormLevelValidator = (
  values: FormValues,
) => Record<string, string> | null | undefined | void;

export interface ValidationSchema {
  /**
   * Per-field rules, keyed by dot-path (scope-relative; nested paths like
   * "employee.firstName" work). A path may map to one validator or a list —
   * for lists, the first failing rule's message is used.
   */
  fields?: Record<string, FieldRules>;

  /**
   * Form-level validator(s) run after field rules. Their errors are merged
   * in for paths that don't already have a field-level error, so the more
   * specific per-field message wins.
   */
  form?: FormLevelValidator | readonly FormLevelValidator[];
}

export interface ValidationResult {
  /** Errors keyed by field path; empty object when everything validates. */
  errors: Record<string, string>;
  /** `true` when `errors` is empty. */
  isValid: boolean;
}