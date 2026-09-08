import { describe, expect, it } from "vitest";
import { defaultNormalize } from "../src/core/utils/normalize";
import { deepEqual } from "../src/core/utils/deepEqual";

describe("defaultNormalize", () => {
  const ctx = { path: "field" };

  it("extracts .value from a plain change event", () => {
    const event = { target: { type: "text", value: "hello" } };
    expect(defaultNormalize(event, ctx)).toBe("hello");
  });

  it("extracts .checked from a checkbox event", () => {
    const event = { target: { type: "checkbox", checked: true } };
    expect(defaultNormalize(event, ctx)).toBe(true);
  });

  it("passes Date objects through unchanged", () => {
    const date = new Date("2024-01-01");
    expect(defaultNormalize(date, ctx)).toBe(date);
  });

  it("unwraps a single { value } option object", () => {
    expect(defaultNormalize({ value: "BD" }, ctx)).toBe("BD");
  });

  it("unwraps an array of { value } option objects", () => {
    const input = [{ value: "a" }, { value: "b" }];
    expect(defaultNormalize(input, ctx)).toEqual(["a", "b"]);
  });

  it("passes plain primitives through unchanged", () => {
    expect(defaultNormalize("plain", ctx)).toBe("plain");
    expect(defaultNormalize(42, ctx)).toBe(42);
  });
});

describe("deepEqual", () => {
  it("treats identical primitives as equal", () => {
    expect(deepEqual(1, 1)).toBe(true);
    expect(deepEqual("a", "a")).toBe(true);
  });

  it("treats structurally identical objects as equal", () => {
    expect(deepEqual({ a: 1, b: { c: 2 } }, { a: 1, b: { c: 2 } })).toBe(true);
  });

  it("detects a changed nested value", () => {
    expect(deepEqual({ a: { b: 1 } }, { a: { b: 2 } })).toBe(false);
  });

  it("detects a different number of keys", () => {
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });

  it("compares arrays element-wise", () => {
    expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(deepEqual([1, 2, 3], [1, 2, 4])).toBe(false);
    expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
  });
});
