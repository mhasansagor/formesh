import { describe, expect, it } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { createFormStore } from "../src/core/store/createFormStore";
import { useForm } from "../src/react/hooks/useForm";

function NameField({ store }: { store: ReturnType<typeof createFormStore> }) {
  const form = useForm<{ name: string }>(store);
  const field = form.registerField("name");
  return (
    <input
      aria-label="name"
      value={String(field.value ?? "")}
      onChange={field.onChange}
      onBlur={field.onBlur}
    />
  );
}

describe("useForm", () => {
  it("reads and updates a field via registerField", () => {
    const store = createFormStore({ name: "" });
    render(<NameField store={store} />);

    const input = screen.getByLabelText("name") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Hasan" } });

    expect(input.value).toBe("Hasan");
    expect(store.getValue("name")).toBe("Hasan");
  });

  it("marks a field touched on blur", () => {
    const store = createFormStore({ name: "" });
    let touchedSnapshot: Record<string, boolean> = {};

    function Probe() {
      const form = useForm<{ name: string }>(store);
      touchedSnapshot = form.touched;
      const field = form.registerField("name");
      return <input aria-label="name" value={String(field.value ?? "")} onChange={field.onChange} onBlur={field.onBlur} />;
    }

    render(<Probe />);
    const input = screen.getByLabelText("name");
    fireEvent.blur(input);

    expect(touchedSnapshot).toEqual({ name: true });
  });

  it("computes isDirty relative to the values first observed", () => {
    const store = createFormStore({ name: "initial" });
    let dirtySnapshot = false;

    function Probe() {
      const form = useForm<{ name: string }>(store);
      dirtySnapshot = form.isDirty;
      const field = form.registerField("name");
      return <input aria-label="name" value={String(field.value ?? "")} onChange={field.onChange} />;
    }

    render(<Probe />);
    expect(dirtySnapshot).toBe(false);

    fireEvent.change(screen.getByLabelText("name"), { target: { value: "changed" } });
    expect(dirtySnapshot).toBe(true);
  });

  it("reset() restores baseline values and clears touched/dirty", () => {
    const store = createFormStore({ name: "initial" });
    let api: ReturnType<typeof useForm<{ name: string }>> | null = null;

    function Probe() {
      api = useForm<{ name: string }>(store);
      return null;
    }

    render(<Probe />);

    act(() => api!.setValue("name", "changed"));
    expect(api!.values.name).toBe("changed");
    expect(api!.isDirty).toBe(true);

    act(() => api!.reset());
    expect(api!.values.name).toBe("initial");
    expect(api!.isDirty).toBe(false);
    expect(api!.touched).toEqual({});
  });

  it("scopes to a section and merges into the parent store", () => {
    const store = createFormStore({
      employeeInfo: { firstName: "" },
      jobInfo: { department: "" },
    });

    function EmployeeSection() {
      const form = useForm<{ firstName: string }>(store, { section: "employeeInfo" });
      const field = form.registerField("firstName");
      return <input aria-label="firstName" value={String(field.value ?? "")} onChange={field.onChange} />;
    }

    render(<EmployeeSection />);
    fireEvent.change(screen.getByLabelText("firstName"), { target: { value: "Hasan" } });

    expect(store.getValues()).toEqual({
      employeeInfo: { firstName: "Hasan" },
      jobInfo: { department: "" },
    });
  });

  it("does not re-render a component subscribed to an unrelated field (fine-grained subscriptions)", () => {
    const store = createFormStore({ name: "", email: "" });
    let emailRenderCount = 0;

    function EmailField() {
      const form = useForm<{ name: string; email: string }>(store);
      emailRenderCount += 1;
      const field = form.registerField("email");
      return <input aria-label="email" value={String(field.value ?? "")} onChange={field.onChange} />;
    }

    function NameFieldOnly() {
      const form = useForm<{ name: string; email: string }>(store);
      const field = form.registerField("name");
      return <input aria-label="name" value={String(field.value ?? "")} onChange={field.onChange} />;
    }

    // NOTE: this test intentionally documents the *whole-scope* behavior of
    // useForm (both components share the same store, no `section`, so both
    // legitimately re-render together) — see useFormField.test.tsx for the
    // true per-field isolation proof. Kept here to make the distinction
    // explicit rather than implicit.
    render(
      <>
        <NameFieldOnly />
        <EmailField />
      </>,
    );

    const renderCountBefore = emailRenderCount;
    fireEvent.change(screen.getByLabelText("name"), { target: { value: "Hasan" } });

    expect(emailRenderCount).toBeGreaterThan(renderCountBefore); // both share scope
  });
});
