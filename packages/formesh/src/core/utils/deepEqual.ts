/**
 * Structural equality for plain JSON-like form values (objects, arrays,
 * primitives). Non-plain values (Date, File, custom classes) fall back to
 * `Object.is` rather than field-by-field inspection — sufficient for dirty
 * tracking, since those values are typically replaced wholesale rather than
 * mutated in place. Revisit only if a real use case needs otherwise.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }

  const aIsPlainObject =
    typeof a === "object" && a !== null && !Array.isArray(a) && a.constructor === Object;
  const bIsPlainObject =
    typeof b === "object" && b !== null && !Array.isArray(b) && b.constructor === Object;

  if (aIsPlainObject && bIsPlainObject) {
    const aKeys = Object.keys(a as Record<string, unknown>);
    const bKeys = Object.keys(b as Record<string, unknown>);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((key) =>
      deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
    );
  }

  return false;
}
