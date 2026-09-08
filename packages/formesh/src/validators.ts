// Phase 2: ready-made validators for the validation schema consumed by
// `useForm({ validation })` / `validateValues`. Every factory returns a
// pure `Validator` — (value, context) => message | undefined — so custom
// rules compose with these on equal footing.
//
// Conventions shared by all of them:
// - An ABSENT value (undefined/null) is only `required()`'s concern; every
//   other rule passes absent values through so "optional but validated"
//   fields work (e.g. optional email that must be well-formed if given).
// - Rules that don't apply to a value's type pass (e.g. `min` ignores
//   strings) — type enforcement belongs to the field's normalizer.
// - Messages are plain English defaults; every factory accepts an override
//   (i18n/error-message catalogs are a later-phase concern).

import type { Validator } from "./core/types/validation";
import { deepEqual } from "./core/utils/deepEqual";
import { getAtPath } from "./core/utils/paths";

/** Fails on undefined, null, empty string, whitespace-only string, empty array. */
export function required(message = "This field is required."): Validator {
  return (value) => {
    if (value === undefined || value === null) return message;
    if (typeof value === "string" && value.trim() === "") return message;
    if (Array.isArray(value) && value.length === 0) return message;
    return undefined;
  };
}

export function minLength(limit: number, message?: string): Validator {
  const msg = message ?? `Must be at least ${limit} characters.`;
  return (value) => {
    if (value === undefined || value === null) return undefined;
    const length = typeof value === "string" || Array.isArray(value) ? value.length : undefined;
    return length !== undefined && length < limit ? msg : undefined;
  };
}

export function maxLength(limit: number, message?: string): Validator {
  const msg = message ?? `Must be at most ${limit} characters.`;
  return (value) => {
    if (value === undefined || value === null) return undefined;
    const length = typeof value === "string" || Array.isArray(value) ? value.length : undefined;
    return length !== undefined && length > limit ? msg : undefined;
  };
}

export function pattern(regex: RegExp, message = "Invalid format."): Validator {
  return (value) =>
    typeof value === "string" && value !== "" && !regex.test(value) ? message : undefined;
}

export function email(message = "Enter a valid email address."): Validator {
  return pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, message);
}

export function min(bound: number, message?: string): Validator {
  const msg = message ?? `Must be ${bound} or more.`;
  return (value) =>
    typeof value === "number" && Number.isFinite(value) && value < bound ? msg : undefined;
}

export function max(bound: number, message?: string): Validator {
  const msg = message ?? `Must be ${bound} or less.`;
  return (value) =>
    typeof value === "number" && Number.isFinite(value) && value > bound ? msg : undefined;
}

/** Value must be one of the given options (selects, dropdowns). */
export function oneOf(allowed: readonly unknown[], message = "Invalid selection."): Validator {
  return (value) => {
    if (value === undefined || value === null || value === "") return undefined;
    return allowed.includes(value) ? undefined : message;
  };
}

/**
 * Cross-field equality: the field's value must deeply equal the value at
 * `otherPath` (scope-relative) — confirm-password, confirm-email, and the
 * equality flavor of date-range checks.
 */
export function matches(otherPath: string, message?: string): Validator {
  const msg = message ?? `Must match ${otherPath}.`;
  return (value, { values }) =>
    deepEqual(value, getAtPath(values, otherPath)) ? undefined : msg;
}
