import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { createFormStore } from "../src/core/store/createFormStore";
import { useDebouncedSync } from "../src/react/hooks/useDebouncedSync";
import type { DebouncedSync } from "../src/core/types/sync";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useDebouncedSync", () => {
  it("returns a wrapper that buffers writes before they reach the store", () => {
    const store = createFormStore({ name: "" });
    let sync: DebouncedSync<{ name: string }> | null = null;

    function Probe() {
      sync = useDebouncedSync(store, { delay: 150 });
      return null;
    }

    render(<Probe />);

    act(() => sync!.setValue("name", "Hasan"));

    // Read-through shows the typed value immediately...
    expect(sync!.getValue("name")).toBe("Hasan");
    // ...but the store has not been committed to yet.
    expect(store.getValue("name")).toBe("");

    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(store.getValue("name")).toBe("Hasan");
  });

  it("flushes buffered writes on unmount by default (trailing keystrokes survive navigation)", () => {
    const store = createFormStore({ name: "" });
    let sync: DebouncedSync<{ name: string }> | null = null;

    function Probe() {
      sync = useDebouncedSync(store, { delay: 1000 });
      return null;
    }

    const { unmount } = render(<Probe />);

    act(() => sync!.setValue("name", "Hasan"));
    unmount(); // unmounts before the 1000ms debounce elapses

    expect(store.getValue("name")).toBe("Hasan");
  });

  it("cancels buffered writes on unmount when flushOnUnmount is false", () => {
    const store = createFormStore({ name: "" });
    let sync: DebouncedSync<{ name: string }> | null = null;

    function Probe() {
      sync = useDebouncedSync(store, { delay: 1000, flushOnUnmount: false });
      return null;
    }

    const { unmount } = render(<Probe />);

    act(() => sync!.setValue("name", "Hasan"));
    unmount();
    vi.advanceTimersByTime(2000);

    expect(store.getValue("name")).toBe("");
  });

  it("keeps the same wrapper instance across re-renders", () => {
    const store = createFormStore({ name: "" });
    const instances: DebouncedSync<{ name: string }>[] = [];

    function Probe({ label }: { label: string }) {
      instances.push(useDebouncedSync(store, { delay: 100 }));
      return <span>{label}</span>;
    }

    const { rerender } = render(<Probe label="a" />);
    rerender(<Probe label="b" />);
    rerender(<Probe label="c" />);

    expect(instances[0]).toBe(instances[1]);
    expect(instances[1]).toBe(instances[2]);
  });
});