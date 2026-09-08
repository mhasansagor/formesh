import { describe, expect, it, vi } from "vitest";
import { createFormStore } from "../src/core/store/createFormStore";

describe("createFormStore", () => {
  it("returns the initial values", () => {
    const store = createFormStore({ name: "", email: "" });
    expect(store.getValues()).toEqual({ name: "", email: "" });
  });

  it("reads a single value by dot-path", () => {
    const store = createFormStore({ employee: { name: "Hasan" } });
    expect(store.getValue("employee.name")).toBe("Hasan");
  });

  it("returns undefined for a path that doesn't exist", () => {
    const store = createFormStore({ employee: { name: "Hasan" } });
    expect(store.getValue("employee.missing")).toBeUndefined();
  });

  it("writes a single value by dot-path without mutating the previous object", () => {
    const store = createFormStore({ employee: { name: "", email: "" } });
    const before = store.getValues();
    store.setValue("employee.name", "Hasan");

    expect(before).toEqual({ employee: { name: "", email: "" } }); // untouched
    expect(store.getValues()).toEqual({ employee: { name: "Hasan", email: "" } });
  });

  it("merges setValues shallowly at the top level", () => {
    const store = createFormStore({ name: "", email: "", age: 0 });
    store.setValues({ name: "Hasan", age: 30 });
    expect(store.getValues()).toEqual({ name: "Hasan", email: "", age: 30 });
  });

  it("resets back to the initial values", () => {
    const store = createFormStore({ name: "" });
    store.setValue("name", "Hasan");
    store.reset();
    expect(store.getValues()).toEqual({ name: "" });
  });

  it("resets to a new baseline when one is provided", () => {
    const store = createFormStore({ name: "" });
    store.setValue("name", "Hasan");
    store.reset({ name: "Sagor" });
    expect(store.getValues()).toEqual({ name: "Sagor" });
    expect(store.getInitialValues()).toEqual({ name: "Sagor" });
  });

  it("notifies subscribers with the changed dot-paths", () => {
    const store = createFormStore({ employee: { name: "", email: "" } });
    const listener = vi.fn();
    store.subscribe(listener);

    store.setValue("employee.name", "Hasan");

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(["employee.name"]);
  });

  it("does not notify subscribers when a set is a no-op", () => {
    const store = createFormStore({ name: "Hasan" });
    const listener = vi.fn();
    store.subscribe(listener);

    store.setValue("name", "Hasan"); // same value

    expect(listener).not.toHaveBeenCalled();
  });

  it("stops notifying after unsubscribe", () => {
    const store = createFormStore({ name: "" });
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    unsubscribe();
    store.setValue("name", "Hasan");

    expect(listener).not.toHaveBeenCalled();
  });

  it("leaves sibling branches referentially unchanged (structural sharing)", () => {
    const store = createFormStore({
      employeeInfo: { name: "" },
      jobInfo: { department: "" },
    });
    const beforeJobInfo = store.getValues().jobInfo;

    store.setValue("employeeInfo.name", "Hasan");

    expect(store.getValues().jobInfo).toBe(beforeJobInfo);
  });
});
