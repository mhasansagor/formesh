import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { createFormStore } from "../src/core/store/createFormStore";
import { useFormField } from "../src/react/hooks/useFormField";

describe("useFormField", () => {
  it("updates the subscribed field's value", () => {
    const store = createFormStore({ name: "", email: "" });

    function NameField() {
      const field = useFormField<string>(store, "name");
      return <input aria-label="name" value={field.value ?? ""} onChange={field.onChange} />;
    }

    render(<NameField />);
    fireEvent.change(screen.getByLabelText("name"), { target: { value: "Hasan" } });

    expect(store.getValue("name")).toBe("Hasan");
  });

  it("does NOT re-render a component subscribed to a different field on the same store", () => {
    const store = createFormStore({ name: "", email: "" });
    let emailRenderCount = 0;

    function EmailField() {
      emailRenderCount += 1;
      const field = useFormField<string>(store, "email");
      return <input aria-label="email" value={field.value ?? ""} onChange={field.onChange} />;
    }

    function NameField() {
      const field = useFormField<string>(store, "name");
      return <input aria-label="name" value={field.value ?? ""} onChange={field.onChange} />;
    }

    render(
      <>
        <NameField />
        <EmailField />
      </>,
    );

    const before = emailRenderCount;
    fireEvent.change(screen.getByLabelText("name"), { target: { value: "Hasan" } });

    // This is the concrete proof for roadmap section 10 / Phase 1's
    // Definition of Done: changing `name` must not cause a component
    // subscribed only to `email` to re-render.
    expect(emailRenderCount).toBe(before);
  });

  it("DOES re-render when its own field changes", () => {
    const store = createFormStore({ name: "" });
    let renderCount = 0;

    function NameField() {
      renderCount += 1;
      const field = useFormField<string>(store, "name");
      return <input aria-label="name" value={field.value ?? ""} onChange={field.onChange} />;
    }

    render(<NameField />);
    const before = renderCount;
    fireEvent.change(screen.getByLabelText("name"), { target: { value: "Hasan" } });

    expect(renderCount).toBeGreaterThan(before);
  });
});
