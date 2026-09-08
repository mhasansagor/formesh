import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { createFormStore } from "../src/core/store/createFormStore";
import { useDebouncedSync } from "../src/react/hooks/useDebouncedSync";
import { useForm } from "../src/react/hooks/useForm";
import { email, matches, min, required } from "../src/validators";
import type { ValidationSchema } from "../src/core/types/validation";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useForm validation", () => {
  it("computes errors and isValid reactively from the schema", () => {
    const store = createFormStore({ name: "" });
    let snapshot: { errors: Record<string, string>; isValid: boolean } | null = null;

    function Probe() {
      const form = useForm<{ name: string }>(store, {
        validation: { fields: { name: required() } },
      });
      snapshot = { errors: form.errors, isValid: form.isValid };
      const field = form.registerField("name");
      return <input aria-label="name" value={String(field.value ?? "")} onChange={field.onChange} />;
    }

    render(<Probe />);

    // Invalid from the start (empty initial value fails required()).
    expect(snapshot!.errors).toEqual({ name: "This field is required." });
    expect(snapshot!.isValid).toBe(false);

    fireEvent.change(screen.getByLabelText("name"), { target: { value: "Hasan" } });
    expect(snapshot!.errors).toEqual({});
    expect(snapshot!.isValid).toBe(true);

    // Clearing the field invalidates again — errors track every change.
    fireEvent.change(screen.getByLabelText("name"), { target: { value: "" } });
    expect(snapshot!.isValid).toBe(false);
  });

  it("uses the first failing rule's message per field", () => {
    const store = createFormStore({ name: "" });
    let errors: Record<string, string> = {};

    function Probe() {
      const form = useForm<{ name: string }>(store, {
        validation: {
          fields: {
            name: [
              required("Name is required."),
              (value) => (String(value).length >= 3 ? undefined : "Too short."),
            ],
          },
        },
      });
      errors = form.errors;
      return null;
    }

    render(<Probe />);
    expect(errors).toEqual({ name: "Name is required." });

    // Once the value is non-empty, the next rule (length) is what reports.
    act(() => store.setValue("name", "Ha"));
    expect(errors).toEqual({ name: "Too short." });

    act(() => store.setValue("name", "Hasan"));
    expect(errors).toEqual({});
  });

  it("exposes errors for all paths regardless of touched state", () => {
    const store = createFormStore({ name: "" });
    let errors: Record<string, string> = {};

    function Probe() {
      const form = useForm<{ name: string }>(store, {
        validation: { fields: { name: required() } },
      });
      errors = form.errors;
      return null;
    }

    render(<Probe />);
    // Documented behavior: errors are exposed for all paths regardless of
    // touched state; gating by touch is the consumer's choice.
    expect(errors).toEqual({ name: "This field is required." });
  });

  it("validates section-scoped forms with section-relative paths", () => {
    const store = createFormStore({
      employeeInfo: { firstName: "", email: "" },
      jobInfo: { department: "" },
    });
    let errors: Record<string, string> = {};
    let isValid = true;

    function EmployeeSection() {
      const form = useForm<{ firstName: string; email: string }>(store, {
        section: "employeeInfo",
        validation: {
          fields: { firstName: required(), email: email() },
        },
      });
      errors = form.errors;
      isValid = form.isValid;
      const field = form.registerField("email");
      return <input aria-label="email" value={String(field.value ?? "")} onChange={field.onChange} />;
    }

    render(<EmployeeSection />);

    // Typed into email: still invalid — firstName's required error is also
    // present, with scope-relative keys.
    fireEvent.change(screen.getByLabelText("email"), { target: { value: "not-an-email" } });
    expect(Object.keys(errors).sort()).toEqual(["email", "firstName"]);
    expect(errors["email"]).toMatch(/email/i);
    expect(isValid).toBe(false);

    // Fixing firstName (written directly through the store by another
    // subscriber) clears its error without touching the email one.
    act(() => store.setValue("employeeInfo.firstName", "Hasan"));
    expect(Object.keys(errors)).toEqual(["email"]);

    fireEvent.change(screen.getByLabelText("email"), { target: { value: "hasan@erp.dev" } });
    expect(errors).toEqual({});
    expect(isValid).toBe(true);

    // The parent store holds the complete, validated object.
    expect(store.getValue("employeeInfo")).toEqual({
      firstName: "Hasan",
      email: "hasan@erp.dev",
    });
  });

  it("supports cross-field rules via form-level validators (date range)", () => {
    const store = createFormStore({ startDate: "2026-02-01", endDate: "2026-01-01" });
    let errors: Record<string, string> = {};

    const dateRange: ValidationSchema = {
      fields: { startDate: required(), endDate: required() },
      form: (values) =>
        String(values.startDate) > String(values.endDate)
          ? { endDate: "End date must be after start date." }
          : undefined,
    };

    function Probe() {
      const form = useForm<{ startDate: string; endDate: string }>(store, {
        validation: dateRange,
      });
      errors = form.errors;
      const endField = form.registerField("endDate");
      return (
        <input aria-label="endDate" value={String(endField.value ?? "")} onChange={endField.onChange} />
      );
    }

    render(<Probe />);
    expect(errors["endDate"]).toMatch(/after start date/);

    fireEvent.change(screen.getByLabelText("endDate"), { target: { value: "2026-03-01" } });
    expect(errors).toEqual({});
  });

  it("supports confirm-field rules via matches()", () => {
    const store = createFormStore({ password: "s3cret", confirmPassword: "" });
    let errors: Record<string, string> = {};

    function Probe() {
      const form = useForm<{ password: string; confirmPassword: string }>(store, {
        validation: {
          fields: { confirmPassword: matches("password", "Passwords do not match.") },
        },
      });
      errors = form.errors;
      const field = form.registerField("confirmPassword");
      return (
        <input aria-label="confirmPassword" value={String(field.value ?? "")} onChange={field.onChange} />
      );
    }

    render(<Probe />);
    expect(errors).toEqual({ confirmPassword: "Passwords do not match." });

    fireEvent.change(screen.getByLabelText("confirmPassword"), { target: { value: "s3cret" } });
    expect(errors).toEqual({});
  });

  it("validates numeric bounds (budget caps)", () => {
    const store = createFormStore({ budget: 50 });
    let errors: Record<string, string> = {};

    function Probe() {
      const form = useForm<{ budget: number }>(store, {
        validation: { fields: { budget: min(100, "Budget must be at least 100.") } },
      });
      errors = form.errors;
      return null;
    }

    render(<Probe />);
    expect(errors).toEqual({ budget: "Budget must be at least 100." });

    act(() => store.setValue("budget", 250));
    expect(errors).toEqual({});
  });

  it("stays valid with no schema (stable empty errors)", () => {
    const store = createFormStore({ name: "" });
    let isValid = true;
    let errors: Record<string, string> = {};

    function Probe() {
      const form = useForm<{ name: string }>(store);
      isValid = form.isValid;
      errors = form.errors;
      return null;
    }

    render(<Probe />);
    act(() => store.setValue("name", "anything"));
    expect(isValid).toBe(true);
    expect(errors).toEqual({});
  });

  it("validate() re-reads the target's current values for submit-time checks", () => {
    const store = createFormStore({ name: "" });
    let validate: () => { isValid: boolean; errors: Record<string, string> } = () => {
      throw new Error("not wired");
    };

    function Probe() {
      const form = useForm<{ name: string }>(store, {
        validation: { fields: { name: required() } },
      });
      validate = form.validate;
      return null;
    }

    render(<Probe />);

    // Write directly to the store after render; validate() must see it.
    act(() => store.setValue("name", ""));
    expect(validate().isValid).toBe(false);
    expect(validate().errors).toEqual({ name: "This field is required." });

    act(() => store.setValue("name", "Hasan"));
    expect(validate().isValid).toBe(true);
  });

  it("composes validation with a debounced sync target — errors react per keystroke", () => {
    const store = createFormStore({ name: "" });
    let isValid = true;
    let errors: Record<string, string> = {};

    function Probe() {
      const sync = useDebouncedSync(store, { delay: 1000 });
      const form = useForm<{ name: string }>(sync, {
        validation: {
          fields: {
            name: [required(), (v) => (String(v).length >= 3 ? undefined : "Too short.")],
          },
        },
      });
      isValid = form.isValid;
      errors = form.errors;
      const field = form.registerField("name");
      return <input aria-label="name" value={String(field.value ?? "")} onChange={field.onChange} />;
    }

    render(<Probe />);

    // One keystroke: validation sees the read-through value immediately,
    // while the store is still untouched.
    fireEvent.change(screen.getByLabelText("name"), { target: { value: "Ha" } });
    expect(errors).toEqual({ name: "Too short." });
    expect(isValid).toBe(false);
    expect(store.getValue("name")).toBe("");

    // Second keystroke inside the same quiet period: error clears BEFORE
    // the debounce commits anything.
    fireEvent.change(screen.getByLabelText("name"), { target: { value: "Has" } });
    expect(errors).toEqual({});
    expect(isValid).toBe(true);
    expect(store.getValue("name")).toBe("");

    // The commit lands afterward with the final value only.
    act(() => vi.advanceTimersByTime(1000));
    expect(store.getValue("name")).toBe("Has");
    expect(errors).toEqual({});
  });
});