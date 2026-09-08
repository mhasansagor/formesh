import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFormStore } from "../src/core/store/createFormStore";
import { createFormSection } from "../src/core/store/createFormSection";
import { createDebouncedSync } from "../src/core/store/createDebouncedSync";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createDebouncedSync over a store", () => {
  it("buffers writes and commits them to the target in one commit after the delay", () => {
    const store = createFormStore({ name: "", email: "" });
    const targetListener = vi.fn();
    store.subscribe(targetListener);
    const sync = createDebouncedSync(store, { delay: 250 });

    sync.setValue("name", "Hasan");
    sync.setValue("email", "hasan@example.com");

    // Nothing has hit the store yet.
    expect(store.getValue("name")).toBe("");
    expect(store.getValue("email")).toBe("");

    vi.advanceTimersByTime(250);

    expect(store.getValue("name")).toBe("Hasan");
    expect(store.getValue("email")).toBe("hasan@example.com");
    // The whole batch is exactly ONE commit/notify on the target.
    expect(targetListener).toHaveBeenCalledTimes(1);
    expect(targetListener).toHaveBeenCalledWith(["name", "email"]);
  });

  it("restarts the timer on every write (trailing-edge debounce, not throttle)", () => {
    const store = createFormStore({ name: "" });
    const sync = createDebouncedSync(store, { delay: 300 });

    sync.setValue("name", "a");
    vi.advanceTimersByTime(200);
    sync.setValue("name", "ab");
    vi.advanceTimersByTime(200); // 400ms total, but only 200ms since last write

    expect(store.getValue("name")).toBe("");

    vi.advanceTimersByTime(100);
    expect(store.getValue("name")).toBe("ab");
  });

  it("keeps the last write per path (later write wins)", () => {
    const store = createFormStore({ name: "" });
    const sync = createDebouncedSync(store, { delay: 100 });

    sync.setValue("name", "first");
    sync.setValue("name", "second");

    vi.advanceTimersByTime(100);

    expect(store.getValue("name")).toBe("second");
  });

  it("supports nested dot-paths without clobbering sibling keys", () => {
    const store = createFormStore({
      employeeInfo: { firstName: "", address: { city: "Chattogram", country: "BD" } },
    });
    const sync = createDebouncedSync(store, { delay: 100 });

    sync.setValue("employeeInfo.address.city", "Dhaka");
    vi.advanceTimersByTime(100);

    expect(store.getValues()).toEqual({
      employeeInfo: { firstName: "", address: { city: "Dhaka", country: "BD" } },
    });
  });

  it("reads through pending writes immediately (UI never lags behind typing)", () => {
    const store = createFormStore({ name: "", email: "" });
    const sync = createDebouncedSync(store, { delay: 300 });

    sync.setValue("name", "Hasan");

    expect(sync.getValue("name")).toBe("Hasan");
    expect(sync.getValues()).toEqual({ name: "Hasan", email: "" });
    // ...while the target itself is still untouched.
    expect(store.getValue("name")).toBe("");
  });

  it("caches the read-through snapshot so it is safe as a useSyncExternalStore snapshot", () => {
    const store = createFormStore({ name: "" });
    const sync = createDebouncedSync(store, { delay: 300 });

    sync.setValue("name", "Hasan");

    expect(sync.getValues()).toBe(sync.getValues());
  });

  it("notifies its own subscribers immediately on buffer, and does not re-announce on flush", () => {
    const store = createFormStore({ name: "" });
    const sync = createDebouncedSync(store, { delay: 200 });
    const listener = vi.fn();
    sync.subscribe(listener);

    sync.setValue("name", "Hasan");

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(["name"]);

    vi.advanceTimersByTime(200);

    expect(listener).toHaveBeenCalledTimes(1); // no double announcement
  });
  it("flush() commits immediately and clears the pending timer", () => {
    const store = createFormStore({ name: "", email: "" });
    const targetListener = vi.fn();
    store.subscribe(targetListener);
    const sync = createDebouncedSync(store, { delay: 500 });

    sync.setValue("name", "Hasan");
    sync.setValue("email", "hasan@example.com");
    sync.flush();

    expect(store.getValues()).toEqual({ name: "Hasan", email: "hasan@example.com" });
    expect(targetListener).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1000);
    expect(targetListener).toHaveBeenCalledTimes(1); // timer was cleared
  });

  it("cancel() drops buffered writes without touching the target", () => {
    const store = createFormStore({ name: "" });
    const targetListener = vi.fn();
    store.subscribe(targetListener);
    const sync = createDebouncedSync(store, { delay: 100 });

    sync.setValue("name", "Hasan");
    sync.cancel();
    vi.advanceTimersByTime(1000);

    expect(store.getValue("name")).toBe("");
    expect(targetListener).not.toHaveBeenCalled();
    expect(sync.pendingCount).toBe(0);
  });

  it("reports pendingCount while writes are buffered", () => {
    const store = createFormStore({ name: "", email: "" });
    const sync = createDebouncedSync(store, { delay: 100 });

    expect(sync.pendingCount).toBe(0);

    sync.setValue("name", "a");
    sync.setValue("email", "b");
    expect(sync.pendingCount).toBe(2);

    vi.advanceTimersByTime(100);
    expect(sync.pendingCount).toBe(0);
  });

  it("buffers setValues into the same single commit", () => {
    const store = createFormStore({ name: "", email: "", age: 0 });
    const targetListener = vi.fn();
    store.subscribe(targetListener);
    const sync = createDebouncedSync(store, { delay: 100 });

    sync.setValues({ name: "Hasan", email: "hasan@example.com", age: 30 });

    expect(sync.getValue("age")).toBe(30); // read-through
    vi.advanceTimersByTime(100);

    expect(store.getValues()).toEqual({ name: "Hasan", email: "hasan@example.com", age: 30 });
    expect(targetListener).toHaveBeenCalledTimes(1);
  });

  it("reset() cancels pending writes and forwards the reset", () => {
    const store = createFormStore({ name: "" });
    const sync = createDebouncedSync(store, { delay: 100 });

    sync.setValue("name", "Hasan");
    sync.reset({ name: "fresh" });
    vi.advanceTimersByTime(1000);

    expect(store.getValue("name")).toBe("fresh");
  });

  it("forwards external target changes to its subscribers", () => {
    const store = createFormStore({ name: "", email: "" });
    const sync = createDebouncedSync(store, { delay: 100 });
    const listener = vi.fn();
    sync.subscribe(listener);

    store.setValue("email", "someone@example.com"); // not via the wrapper

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(["email"]);
  });

  it("does not commit when the flush turns out to be a no-op", () => {
    const store = createFormStore({ name: "Hasan" });
    const targetListener = vi.fn();
    store.subscribe(targetListener);
    const sync = createDebouncedSync(store, { delay: 100 });

    sync.setValue("name", "Hasan"); // same value as the store already has
    vi.advanceTimersByTime(100);

    expect(targetListener).not.toHaveBeenCalled();
  });
  it("watches read-through values, firing per buffered change", () => {
    const store = createFormStore({ country: "BD", city: "Chattogram" });
    const sync = createDebouncedSync(store, { delay: 300 });
    const watchListener = vi.fn();
    sync.watch("country", watchListener);

    sync.setValue("country", "US");
    expect(watchListener).toHaveBeenCalledTimes(1);
    expect(watchListener).toHaveBeenCalledWith("US", "BD");

    // The flush must not fire the watcher again for the same change.
    vi.advanceTimersByTime(300);
    expect(watchListener).toHaveBeenCalledTimes(1);
  });
});

describe("createDebouncedSync over a section", () => {
  it("batches section writes into one parent-store commit", () => {
    const store = createFormStore({
      employeeInfo: { firstName: "", lastName: "" },
      jobInfo: { department: "" },
    });
    const employee = createFormSection(store, "employeeInfo");
    const sync = createDebouncedSync(employee, { delay: 100 });
    const targetListener = vi.fn();
    store.subscribe(targetListener);

    sync.setValue("firstName", "Hasan");
    sync.setValue("lastName", "Sagor");

    // Read-through uses section-relative paths.
    expect(sync.getValue("firstName")).toBe("Hasan");
    // Parent still untouched.
    expect(store.getValue("employeeInfo.firstName")).toBe("");

    vi.advanceTimersByTime(100);

    expect(store.getValues()).toEqual({
      employeeInfo: { firstName: "Hasan", lastName: "Sagor" },
      jobInfo: { department: "" },
    });
    expect(targetListener).toHaveBeenCalledTimes(1);
    expect(targetListener).toHaveBeenCalledWith([
      "employeeInfo.firstName",
      "employeeInfo.lastName",
    ]);
  });

  it("ignores changes from sibling sections", () => {
    const store = createFormStore({
      employeeInfo: { firstName: "" },
      jobInfo: { department: "" },
    });
    const employee = createFormSection(store, "employeeInfo");
    const sync = createDebouncedSync(employee, { delay: 100 });
    const listener = vi.fn();
    sync.subscribe(listener);

    store.setValue("jobInfo.department", "Engineering");

    // The change is outside this section — nothing relevant to announce.
    expect(listener).not.toHaveBeenCalled();
  });

  it("forwards same-section external changes with relative paths", () => {
    const store = createFormStore({ employeeInfo: { firstName: "" } });
    const employee = createFormSection(store, "employeeInfo");
    const sync = createDebouncedSync(employee, { delay: 100 });
    const listener = vi.fn();
    sync.subscribe(listener);

    store.setValue("employeeInfo.firstName", "Hasan");

    expect(listener).toHaveBeenCalledWith(["firstName"]);
  });
});