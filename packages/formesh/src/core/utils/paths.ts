/**
 * Minimal, dependency-free dot-path helpers.
 *
 * Deliberately not using lodash here (get/set/isEqual) even though the
 * reference application relies on it — the whole store is small enough that
 * shipping ~30 lines here beats pulling in a runtime dependency for a
 * library meant to stay near-zero-dependency (see roadmap: "Dependency
 * Philosophy").
 */

export function splitPath(path: string): string[] {
  return path.split(".").filter(Boolean);
}

export function getAtPath(source: unknown, path: string): unknown {
  const segments = splitPath(path);
  let current: unknown = source;
  for (const segment of segments) {
    if (current === null || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

/**
 * Returns a new object with `value` written at `path`, cloning only the
 * objects along the path (structural sharing everywhere else). This is what
 * lets subscribers cheaply detect "did the branch I care about change?" via
 * reference equality, without deep-cloning the whole form on every keystroke.
 */
export function setAtPath<T extends Record<string, unknown>>(
  source: T,
  path: string,
  value: unknown,
): T {
  const segments = splitPath(path);
  if (segments.length === 0) return source;

  const [head, ...rest] = segments as [string, ...string[]];

  if (rest.length === 0) {
    if (Object.is((source as Record<string, unknown>)[head], value)) {
      return source;
    }
    return { ...source, [head]: value };
  }

  const currentChild = (source as Record<string, unknown>)[head];
  const childSource =
    currentChild !== null && typeof currentChild === "object"
      ? (currentChild as Record<string, unknown>)
      : {};

  const nextChild = setAtPath(childSource, rest.join("."), value);

  if (Object.is(currentChild, nextChild)) {
    return source;
  }

  return { ...source, [head]: nextChild };
}

/**
 * Shallow-merges `partial` into `source` at the top level, one key at a
 * time, reusing setAtPath so each key's structural-sharing behavior stays
 * consistent with single-field writes.
 */
export function mergeAtRoot<T extends Record<string, unknown>>(
  source: T,
  partial: Partial<T>,
): T {
  let next: T = source;
  for (const key of Object.keys(partial)) {
    next = setAtPath(next, key, (partial as Record<string, unknown>)[key]);
  }
  return next;
}

/**
 * Returns every dot-path whose leaf value differs (by reference, via
 * Object.is) between `prev` and `next`, walking both objects together.
 * Used to compute exactly which paths to notify subscribers about.
 */
export function diffPaths(
  prev: unknown,
  next: unknown,
  basePath = "",
  seen: Set<string> = new Set(),
): string[] {
  if (Object.is(prev, next)) {
    return [];
  }

  const prevIsObject = prev !== null && typeof prev === "object" && !Array.isArray(prev);
  const nextIsObject = next !== null && typeof next === "object" && !Array.isArray(next);

  if (!prevIsObject || !nextIsObject) {
    return basePath ? [basePath] : [];
  }

  const keys = new Set([
    ...Object.keys(prev as Record<string, unknown>),
    ...Object.keys(next as Record<string, unknown>),
  ]);

  const changed: string[] = [];
  for (const key of keys) {
    const childPath = basePath ? `${basePath}.${key}` : key;
    if (seen.has(childPath)) continue;
    seen.add(childPath);
    changed.push(
      ...diffPaths(
        (prev as Record<string, unknown>)[key],
        (next as Record<string, unknown>)[key],
        childPath,
        seen,
      ),
    );
  }
  return changed;
}
