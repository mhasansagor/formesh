import { describe, expect, it } from "vitest";
import { validateValues } from "../src/core/validation/validateValues";
import type { Validator } from "../src/core/types/validation";

describe("validateValues", () => {
  it("passes everything when no rules are given", () => {
    const result = validateValues({ name: "", age: 0 }, {});
    expect(result.errors).toEqual({});
    expect(result.isValid).toBe(true);
  });

  it("collects field errors for failing single rules", () => {
    const isEven: Validator = (value) =>
      typeof value === "number" && value % 2 === 0 ? undefined : "Must be even.";

    const result = validateValues({ count: 3 }, { fields: { count: isEven } });
    expect(result.errors).toEqual({ count: "Must be even." });
    expect(result.isValid).toBe(false);
  });

  it("uses the first failing rule's message when a list of rules is given", () => {
    const rules = [
      (value: unknown) => (typeof value === "string" ? undefined : "Must be a string."),
      (value: unknown) => (value === "ok" ? undefined : "Must be ok."),
      (value: unknown) => (value === "nope" ? undefined : "Unreachable rule."),
    ];

    const result = validateValues({ a: "bad" }, { fields: { a: rules } });
    expect(result.errors).toEqual({ a: "Must be ok." });
  });

  it("hands the field's value and the whole values object to rules", () => {
    let seenValue: unknown;
    let seenContext: { path: string; values: unknown } | null = null;

    const spy: Validator = (value, context) => {
      seenValue = value;
      seenContext = context;
      return undefined;
    };

    validateValues(
      { password: "abc", confirm: "abc" },
      { fields: { confirm: spy } },
    );

    expect(seenValue).toBe("abc");
    expect(seenContext).toEqual({ path: "confirm", values: { password: "abc", confirm: "abc" } });
  });

  it("resolves nested dot-path keys against the values object", () => {
    const result = validateValues(
      { employee: { firstName: "" } },
      { fields: { "employee.firstName": () => "Required." } },
    );
    expect(result.errors).toEqual({ "employee.firstName": "Required." });
  });

  it("merges form-level validator errors", () => {
    const result = validateValues(
      { startDate: "2026-02-01", endDate: "2026-01-01" },
      {
        form: (values) =>
          (values as { startDate: string; endDate: string }).startDate >
          (values as { startDate: string; endDate: string }).endDate
            ? { endDate: "End date must be after start date." }
            : undefined,
      },
    );
    expect(result.errors).toEqual({ endDate: "End date must be after start date." });
    expect(result.isValid).toBe(false);
  });

  it("lets field-level errors win over form-level errors for the same path", () => {
    const result = validateValues(
      { name: "" },
      {
        fields: { name: () => "Field rule message." },
        form: () => ({ name: "Form rule message." }),
      },
    );
    expect(result.errors).toEqual({ name: "Field rule message." });
  });

  it("runs multiple form-level validators", () => {
    const result = validateValues(
      { a: 5, b: 100 },
      {
        form: [
          (values) => ((values as { a: number }).a < 10 ? { a: "a too small." } : undefined),
          (values) => ((values as { b: number }).b > 50 ? { b: "b too big." } : undefined),
        ],
      },
    );
    expect(result.errors).toEqual({ a: "a too small.", b: "b too big." });
  });

  it("ignores form-level validators that return nothing", () => {
    const result = validateValues(
      { name: "fine" },
      { form: [() => undefined, () => null] },
    );
    expect(result.isValid).toBe(true);
  });

  it("combines field and form-level errors into one result", () => {
    const result = validateValues(
      { name: "", budget: 500, spent: 900 },
      {
        fields: { name: () => "Name is required." },
        form: () => ({ spent: "Spent exceeds budget." }),
      },
    );
    expect(result.errors).toEqual({
      name: "Name is required.",
      spent: "Spent exceeds budget.",
    });
    expect(result.isValid).toBe(false);
  });
});