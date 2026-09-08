import { describe, expect, it, vi } from "vitest";
import { createFormStore } from "../src/core/store/createFormStore";
import { createFormSection } from "../src/core/store/createFormSection";

describe("FormStore.watch", () => {
  it("fires with (next, previous) when the watched path changes", () => {
    const store = createFormStore({ name: "" });
    const listener = vi.fn();

    store.watch("name", listener);
    store.setValue("name", "Hasan");

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith("Hasan", "");
  });

  it("does not fire on subscribe (no initial invocation)", () => {
    const store = createFormStore({ name: "Hasan" });
    const listener = vi.fn();

    store.watch("name", listener);

    expect(listener).not.toHaveBeenCalled();
  });

  it("fires when a descendant of the watched path changes", () => {
    const store = createFormStore({ employee: { name: "", email: "" } });
    const listener = vi.fn();

    store.watch("employee", listener);
    store.setValue("employee.email", "hasan@example.com");

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(
      { name: "", email: "hasan@example.com" },
      { name: "", email: "" },
    );
  });

  it("does not fire for unrelated paths", () => {
    const store = createFormStore({
      employeeInfo: { firstName: "" },
      jobInfo: { department: "" },
    });
    const listener = vi.fn();

    store.watch("employeeInfo.firstName", listener);
    store.setValue("jobInfo.department", "Engineering");

    expect(listener).not.toHaveBeenCalled();
  });

  it("does not fire when an ancestor is replaced but the watched value is unchanged", () => {
    const store = createFormStore({ employee: { name: "Hasan", email: "a@example.com" } });
    const listener = vi.fn();

    store.watch("employee.name", listener);
    store.setValue("employee", { name: "Hasan", email: "changed@example.com" });

    expect(listener).not.toHaveBeenCalled();
  });

  it("fires when an ancestor replacement actually changes the watched value", () => {
    const store = createFormStore({ employee: { name: "Hasan", email: "a@example.com" } });
    const listener = vi.fn();

    store.watch("employee.name", listener);
    store.setValue("employee", { name: "Sagor", email: "a@example.com" });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith("Sagor", "Hasan");
  });

  it("stops firing after unsubscribe", () => {
    const store = createFormStore({ name: "" });
    const listener = vi.fn();

    const unsubscribe = store.watch("name", listener);
    unsubscribe();
    store.setValue("name", "Hasan");

    expect(listener).not.toHaveBeenCalled();
  });

  it("participates in the batching contract: one commit, one watch fire", () => {
    const store = createFormStore({ qty: 0, price: 0, lineTotal: 0 });
    const listener = vi.fn();

    store.watch("qty", listener);
    store.setValues({ qty: 2, price: 150 });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(2, 0);
  });
});

describe("FormSection.watch", () => {
  it("fires with section-relative path semantics", () => {
    const store = createFormStore({ employeeInfo: { firstName: "" } });
    const employee = createFormSection(store, "employeeInfo");
    const listener = vi.fn();

    employee.watch("firstName", listener);
    employee.setValue("firstName", "Hasan");

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith("Hasan", "");
  });

  it("does not fire for changes in other sections", () => {
    const store = createFormStore({
      employeeInfo: { firstName: "" },
      jobInfo: { department: "" },
    });
    const employee = createFormSection(store, "employeeInfo");
    const listener = vi.fn();

    employee.watch("firstName", listener);
    store.setValue("jobInfo.department", "Engineering");

    expect(listener).not.toHaveBeenCalled();
  });

  it("fires when the section slice is replaced wholesale on the parent", () => {
    const store = createFormStore({ employeeInfo: { firstName: "Old" } });
    const employee = createFormSection(store, "employeeInfo");
    const listener = vi.fn();

    employee.watch("firstName", listener);
    store.setValue("employeeInfo", { firstName: "New" }); // wholesale replacement

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith("New", "Old");
  });

  it("does not fire when the wholesale replacement leaves the value deep-equal", () => {
    const store = createFormStore({ employeeInfo: { firstName: "Same" } });
    const employee = createFormSection(store, "employeeInfo");
    const listener = vi.fn();

    employee.watch("firstName", listener);
    store.setValue("employeeInfo", { firstName: "Same" });

    expect(listener).not.toHaveBeenCalled();
  });

  it("stops firing after unsubscribe", () => {
    const store = createFormStore({ employeeInfo: { firstName: "" } });
    const employee = createFormSection(store, "employeeInfo");
    const listener = vi.fn();

    const unsubscribe = employee.watch("firstName", listener);
    unsubscribe();
    employee.setValue("firstName", "Hasan");

    expect(listener).not.toHaveBeenCalled();
  });
});