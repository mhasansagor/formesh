import { describe, expect, it, vi } from "vitest";
import { createFormStore } from "../src/core/store/createFormStore";
import { createFormSection } from "../src/core/store/createFormSection";

describe("createFormSection", () => {
  it("scopes getValues to just its slice", () => {
    const store = createFormStore({
      employeeInfo: { firstName: "" },
      jobInfo: { department: "" },
    });
    const employee = createFormSection(store, "employeeInfo");

    expect(employee.getValues()).toEqual({ firstName: "" });
  });

  it("writes land on the parent store under the section key", () => {
    const store = createFormStore({ employeeInfo: { firstName: "" } });
    const employee = createFormSection(store, "employeeInfo");

    employee.setValue("firstName", "Hasan");

    expect(store.getValues()).toEqual({ employeeInfo: { firstName: "Hasan" } });
  });

  it("multiple independent sections merge into one parent object", () => {
    const store = createFormStore({
      employeeInfo: { firstName: "" },
      jobInfo: { department: "" },
      bankInfo: { accountNumber: "" },
    });

    createFormSection(store, "employeeInfo").setValue("firstName", "Hasan");
    createFormSection(store, "jobInfo").setValue("department", "Engineering");
    createFormSection(store, "bankInfo").setValue("accountNumber", "12345");

    expect(store.getValues()).toEqual({
      employeeInfo: { firstName: "Hasan" },
      jobInfo: { department: "Engineering" },
      bankInfo: { accountNumber: "12345" },
    });
  });

  it("delivers only relevant, relativized paths to section subscribers", () => {
    const store = createFormStore({
      employeeInfo: { firstName: "" },
      jobInfo: { department: "" },
    });
    const employee = createFormSection(store, "employeeInfo");
    const listener = vi.fn();
    employee.subscribe(listener);

    store.setValue("jobInfo.department", "Engineering"); // unrelated
    expect(listener).not.toHaveBeenCalled();

    store.setValue("employeeInfo.firstName", "Hasan"); // relevant
    expect(listener).toHaveBeenCalledWith(["firstName"]);
  });

  it("resets just its own slice back to that slice's initial values", () => {
    const store = createFormStore({
      employeeInfo: { firstName: "" },
      jobInfo: { department: "" },
    });
    const employee = createFormSection(store, "employeeInfo");

    employee.setValue("firstName", "Hasan");
    createFormSection(store, "jobInfo").setValue("department", "Engineering");

    employee.reset();

    expect(store.getValues()).toEqual({
      employeeInfo: { firstName: "" },
      jobInfo: { department: "Engineering" }, // untouched by employee.reset()
    });
  });
});
