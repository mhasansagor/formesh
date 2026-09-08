import { describe, expect, it } from "vitest";
import { diffPaths, getAtPath, mergeAtRoot, setAtPath } from "../src/core/utils/paths";

describe("getAtPath", () => {
  it("reads nested values", () => {
    expect(getAtPath({ a: { b: { c: 1 } } }, "a.b.c")).toBe(1);
  });

  it("returns undefined when a segment doesn't exist", () => {
    expect(getAtPath({ a: {} }, "a.b.c")).toBeUndefined();
  });

  it("returns undefined when traversing through a non-object", () => {
    expect(getAtPath({ a: 1 }, "a.b")).toBeUndefined();
  });
});

describe("setAtPath", () => {
  it("sets a top-level value immutably", () => {
    const source = { a: 1 };
    const next = setAtPath(source, "a", 2);
    expect(next).toEqual({ a: 2 });
    expect(source).toEqual({ a: 1 });
  });

  it("sets a nested value, creating intermediate objects as needed", () => {
    const next = setAtPath({}, "a.b.c", 1);
    expect(next).toEqual({ a: { b: { c: 1 } } });
  });

  it("returns the same reference when the value is unchanged", () => {
    const source = { a: { b: 1 } };
    const next = setAtPath(source, "a.b", 1);
    expect(next).toBe(source);
  });

  it("only clones objects along the changed path (structural sharing)", () => {
    const source = { a: { x: 1 }, b: { y: 2 } };
    const next = setAtPath(source, "a.x", 99);
    expect(next.b).toBe(source.b);
    expect(next.a).not.toBe(source.a);
  });
});

describe("mergeAtRoot", () => {
  it("shallow merges top-level keys", () => {
    const next = mergeAtRoot({ a: 1, b: 2, c: 3 }, { a: 10, c: 30 });
    expect(next).toEqual({ a: 10, b: 2, c: 30 });
  });
});

describe("diffPaths", () => {
  it("returns an empty list for identical objects", () => {
    const value = { a: 1 };
    expect(diffPaths(value, value)).toEqual([]);
  });

  it("finds a single changed leaf", () => {
    expect(diffPaths({ a: 1, b: 2 }, { a: 1, b: 3 })).toEqual(["b"]);
  });

  it("finds nested changed leaves with full dot-paths", () => {
    const prev = { employee: { name: "", email: "" } };
    const next = { employee: { name: "Hasan", email: "" } };
    expect(diffPaths(prev, next)).toEqual(["employee.name"]);
  });

  it("reports an added key", () => {
    expect(diffPaths({}, { a: 1 })).toEqual(["a"]);
  });
});
