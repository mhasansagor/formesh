import type { NormalizeContext, Normalizer } from "../types/field";

function isEvent(value: unknown): value is { target: EventTarget } {
  return (
    typeof value === "object" &&
    value !== null &&
    "target" in value &&
    typeof (value as { target?: unknown }).target === "object"
  );
}

function isOptionLike(value: unknown): value is { value: unknown } {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Date) &&
    "value" in value
  );
}

/**
 * The default normalizer. Covers the shapes that come up repeatedly across
 * hand-written ERP form components:
 *
 *  - native DOM change events (checkbox vs. everything else)
 *  - `Date` objects (from date pickers) — passed through as-is; callers who
 *    need a serialized string should supply a custom normalizer, since the
 *    right format is app-specific (see roadmap section 13: normalization
 *    decisions must be explicit, not silently opinionated)
 *  - arrays of `{ value }` option objects (multi-selects)
 *  - single `{ value }` option objects (single-selects)
 *  - plain primitives, passed through unchanged
 *
 * This intentionally does not know about any specific UI library. A
 * component whose change shape doesn't match one of the above should be
 * wired with a custom `normalize` function via `FieldOptions`.
 */
export const defaultNormalize: Normalizer = (input: unknown, _context: NormalizeContext) => {
  if (isEvent(input)) {
    const target = input.target as HTMLInputElement;
    if (target.type === "checkbox") {
      return target.checked;
    }
    return target.value;
  }

  if (Array.isArray(input)) {
    return input.map((item) => (isOptionLike(item) ? item.value : item));
  }

  if (input instanceof Date) {
    return input;
  }

  if (isOptionLike(input)) {
    return input.value;
  }

  return input;
};
