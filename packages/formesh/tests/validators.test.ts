import { describe, expect, it } from "vitest";
import {
  email,
  matches,
  max,
  maxLength,
  min,
  minLength,
  oneOf,
  pattern,
  required,
} from "../src/validators";

const validate = (validator: ReturnType<typeof required>, value: unknown, values: unknown = {}) =>
  validator(value, { path: "field", values: values as Record<string, unknown> });

describe("validators", () => {
  describe("required", () => {
    it("fails on absent and empty values", () => {
      expect(validate(required(), undefined)).toMatch(/required/i);
      expect(validate(required(), null)).toMatch(/required/i);
      expect(validate(required(), "")).toMatch(/required/i);
      expect(validate(required(), "   ")).toMatch(/required/i);
      expect(validate(required(), [])).toMatch(/required/i);
    });

    it("passes real values, including falsy-but-present ones", () => {
      expect(validate(required(), 0)).toBeUndefined();
      expect(validate(required(), false)).toBeUndefined();
      expect(validate(required(), "x")).toBeUndefined();
      expect(validate(required(), [1])).toBeUndefined();
    });

    it("uses a custom message when given", () => {
      expect(validate(required("Name please."), "")).toBe("Name please.");
    });
  });

  describe("minLength / maxLength", () => {
    it("measures strings and arrays", () => {
      expect(validate(minLength(3), "ab")).toMatch(/at least 3/);
      expect(validate(minLength(3), "abc")).toBeUndefined();
      expect(validate(minLength(2), ["a"])).toMatch(/at least 2/);
      expect(validate(maxLength(3), "abcd")).toMatch(/at most 3/);
      expect(validate(maxLength(3), "abc")).toBeUndefined();
    });

    it("passes absent values (required's job) and non-sized values", () => {
      expect(validate(minLength(3), undefined)).toBeUndefined();
      expect(validate(minLength(3), 12)).toBeUndefined();
      expect(validate(maxLength(3), null)).toBeUndefined();
    });
  });

  describe("pattern / email", () => {
    it("fails strings that don't match", () => {
      expect(validate(pattern(/^\d+$/), "abc")).toMatch(/format/i);
      expect(validate(pattern(/^\d+$/), "123")).toBeUndefined();
    });

    it("passes empty strings and non-strings (absence is required's job)", () => {
      expect(validate(pattern(/^\d+$/), "")).toBeUndefined();
      expect(validate(pattern(/^\d+$/), 42)).toBeUndefined();
      expect(validate(email(), undefined)).toBeUndefined();
    });

    it("validates basic email shapes", () => {
      expect(validate(email(), "not-an-email")).toMatch(/email/i);
      expect(validate(email(), "a@b.co")).toBeUndefined();
    });
  });

  describe("min / max", () => {
    it("bounds numbers only", () => {
      expect(validate(min(18), 17)).toMatch(/18 or more/);
      expect(validate(min(18), 18)).toBeUndefined();
      expect(validate(max(100), 101)).toMatch(/100 or less/);
      expect(validate(max(100), "many")).toBeUndefined();
      expect(validate(min(1), NaN)).toBeUndefined();
    });
  });

  describe("oneOf", () => {
    it("requires the value to be among the allowed options", () => {
      expect(validate(oneOf(["HR", "IT"]), "HR")).toBeUndefined();
      expect(validate(oneOf(["HR", "IT"]), "Sales")).toMatch(/selection/i);
      expect(validate(oneOf(["HR", "IT"]), undefined)).toBeUndefined();
      expect(validate(oneOf(["HR", "IT"]), "")).toBeUndefined();
    });
  });

  describe("matches", () => {
    it("compares against another path in the values object", () => {
      const values = { password: "s3cret", confirm: "s3cret" };
      expect(validate(matches("password"), "s3cret", values)).toBeUndefined();
      expect(validate(matches("password"), "other", values)).toMatch(/password/);
    });

    it("resolves nested paths", () => {
      const values = { user: { email: "a@b.co" } };
      expect(validate(matches("user.email"), "a@b.co", values)).toBeUndefined();
    });
  });
});