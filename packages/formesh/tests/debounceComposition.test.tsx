import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { createFormStore } from "../src/core/store/createFormStore";
import { createFormSection } from "../src/core/store/createFormSection";
import { createDebouncedSync } from "../src/core/store/createDebouncedSync";
import { useDebouncedSync } from "../src/react/hooks/useDebouncedSync";
import { useForm } from "../src/react/hooks/useForm";
import type { FormStore } from "../src/core/types/store";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("debounced sync composition", () => {
  it("delegates getInitialValues through the store → section → sync chain", () => {
    const store = createFormStore({
      employeeInfo: { firstName: "Hasan", lastName: "Sagor" },
      jobInfo: { department: "Engineering" },
    });

    const section = createFormSection<{ firstName: string; lastName: string }>(
      store,
      "employeeInfo",
    );
    const sync = createDebouncedSync(section);
    const nested = createDebouncedSync(sync); // wrappers can wrap wrappers

    expect(section.getInitialValues()).toEqual({ firstName: "Hasan", lastName: "Sagor" });
    expect(sync.getInitialValues()).toEqual({ firstName: "Hasan", lastName: "Sagor" });
    expect(nested.getInitialValues()).toEqual({ firstName: "Hasan", lastName: "Sagor" });

    // Committed writes never mutate the baseline...
    act(() => {
      sync.setValue("firstName", "Changed");
      sync.flush();
    });
    expect(store.getValue("employeeInfo.firstName")).toBe("Changed");
    expect(sync.getInitialValues()).toEqual({ firstName: "Hasan", lastName: "Sagor" });

    // ...and reset() restores it through the whole chain.
    act(() => sync.reset());
    expect(store.getValue("employeeInfo.firstName")).toBe("Hasan");
  });

  it("wires useDebouncedSync(store) into useForm end-to-end", () => {
    const store = createFormStore({ firstName: "" });

    // This component is the composability promise from the docs, exercised
    // for real: the debounced wrapper is passed straight to useForm, and
    // every useForm interaction (registerField writes, isDirty, reset) goes
    // through the wrapper's read/write/subscribe surface.
    function Probe() {
      const sync = useDebouncedSync(store, { delay: 500 });
      const form = useForm<{ firstName: string }>(sync);
      const field = form.registerField("firstName");
      return (
        <input
          aria-label="firstName"
          value={String(field.value ?? "")}
          onChange={field.onChange}
          onBlur={field.onBlur}
        />
      );
    }

    render(<Probe />);
    const input = screen.getByLabelText("firstName") as HTMLInputElement;

    // Typing lands in the wrapper immediately (read-through)...
    fireEvent.change(input, { target: { value: "Hasan" } });
    expect(input.value).toBe("Hasan");
    // ...but the store has not been committed to yet.
    expect(store.getValue("firstName")).toBe("");

    // After the quiet period, exactly one commit reaches the store.
    act(() => vi.advanceTimersByTime(500));
    expect(store.getValue("firstName")).toBe("Hasan");
  });

  it("exposes the wrapper's read-through values through useForm's FormApi", () => {
    const store = createFormStore({ firstName: "" });
    let snapshot: { isDirty: boolean; value: string } | null = null;

    function Probe() {
      const sync = useDebouncedSync(store, { delay: 1000 });
      const form = useForm<{ firstName: string }>(sync);
      snapshot = { isDirty: form.isDirty, value: form.values.firstName };
      const field = form.registerField("firstName");
      return <input aria-label="firstName" value={String(field.value ?? "")} onChange={field.onChange} />;
    }

    render(<Probe />);
    expect(snapshot!.isDirty).toBe(false);

    // Before the debounce elapses the wrapper's values already differ from
    // the store's — useForm must reflect the read-through state, since that
    // is what it renders from.
    act(() => screen.getByLabelText("firstName").focus());
    fireEvent.change(screen.getByLabelText("firstName"), { target: { value: "Typing..." } });
    expect(snapshot!.isDirty).toBe(true);
    expect(snapshot!.value).toBe("Typing...");
    expect(store.getValue("firstName")).toBe("");

    act(() => vi.advanceTimersByTime(1000));
    expect(store.getValue("firstName")).toBe("Typing...");
  });

  it("composes useDebouncedSync + useForm section scoping against one store", () => {
    const store = createFormStore({
      employeeInfo: { firstName: "" },
      jobInfo: { department: "" },
    });

    function EmployeeSection() {
      // One debounced wrapper per section, each handed to its own useForm.
      const section = useSection("employeeInfo");
      const sync = useDebouncedSync(section, { delay: 100 });
      const form = useForm<{ firstName: string }>(sync);
      const field = form.registerField("firstName");
      return <input aria-label="firstName" value={String(field.value ?? "")} onChange={field.onChange} />;
    }

    function useSection(key: string) {
      // Hook wrapper mirroring useForm's own section plumbing.
      return createSectionHook(store, key);
    }

    render(<EmployeeSection />);
    fireEvent.change(screen.getByLabelText("firstName"), { target: { value: "Hasan" } });

    act(() => vi.advanceTimersByTime(100));
    expect(store.getValues()).toEqual({
      employeeInfo: { firstName: "Hasan" },
      jobInfo: { department: "" },
    });
  });
});

function createSectionHook(store: FormStore, key: string) {
  return createFormSection(store, key);
}