import { describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { createFormStore } from "../src/core/store/createFormStore";
import { useWatch } from "../src/react/hooks/useWatch";

describe("useWatch", () => {
  it("invokes the listener when the watched field changes", () => {
    const store = createFormStore({ country: "", city: "" });
    const listener = vi.fn();

    function Probe() {
      useWatch(store, "country", listener);
      return null;
    }

    render(<Probe />);

    act(() => store.setValue("country", "BD"));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith("BD", "");

    act(() => store.setValue("country", "US"));
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenLastCalledWith("US", "BD");
  });

  it("does not fire for unrelated changes", () => {
    const store = createFormStore({ country: "", city: "" });
    const listener = vi.fn();

    function Probe() {
      useWatch(store, "country", listener);
      return null;
    }

    render(<Probe />);

    act(() => store.setValue("city", "Dhaka"));

    expect(listener).not.toHaveBeenCalled();
  });

  it("always invokes the latest listener closure (no stale closures)", () => {
    const store = createFormStore({ country: "" });
    const seen: string[] = [];

    function Probe({ suffix }: { suffix: string }) {
      useWatch(store, "country", (value) => {
        seen.push(`${value}${suffix}`);
      });
      return null;
    }

    const { rerender } = render(<Probe suffix="-v1" />);
    rerender(<Probe suffix="-v2" />);

    act(() => store.setValue("country", "BD"));

    expect(seen).toEqual(["BD-v2"]);
  });

  it("stops watching after unmount", () => {
    const store = createFormStore({ country: "" });
    const listener = vi.fn();

    function Probe() {
      useWatch(store, "country", listener);
      return null;
    }

    const { unmount } = render(<Probe />);
    unmount();

    act(() => store.setValue("country", "BD"));

    expect(listener).not.toHaveBeenCalled();
  });

  it("can drive a derived field (the cascading/derived-field pattern)", () => {
    const store = createFormStore({ qty: 2, price: 150, lineTotal: 300 });

    function Probe() {
      const recompute = () => {
        const qty = Number(store.getValue("qty")) || 0;
        const price = Number(store.getValue("price")) || 0;
        store.setValue("lineTotal", qty * price);
      };
      useWatch(store, "qty", recompute);
      useWatch(store, "price", recompute);
      return null;
    }

    render(<Probe />);

    act(() => store.setValue("qty", 3));
    expect(store.getValue("lineTotal")).toBe(450);

    act(() => store.setValue("price", 200));
    expect(store.getValue("lineTotal")).toBe(600);
  });
});