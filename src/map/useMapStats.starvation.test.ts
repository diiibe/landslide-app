import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMapStats } from "./useMapStats";
import { setMap } from "./instance";
import { SUSCEPT_LAYER } from "./layers/susceptibility";

/**
 * P1.4: under continuous tile-loading events, the previous debounce reset
 * forever. We dropped the `sourcedata` listener and added a 1.5 s
 * watchdog. This test fires `moveend` events every 50 ms for 2 seconds
 * and asserts at least one compute runs.
 */
type Handler = (...args: unknown[]) => void;

class FakeMap {
  private handlers = new Map<string, Set<Handler>>();
  public queryCalls = 0;
  on(event: string, h: Handler) {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(h);
  }
  off(event: string, h: Handler) {
    this.handlers.get(event)?.delete(h);
  }
  emit(event: string) {
    this.handlers.get(event)?.forEach((h) => h());
  }
  getLayer(id: string) {
    return id === SUSCEPT_LAYER ? { id } : undefined;
  }
  queryRenderedFeatures() {
    this.queryCalls++;
    return [
      { properties: { p: 0.5, zone: "A", iffi_hit: false, sub_zone: "x" } },
      { properties: { p: 0.9, zone: "A", iffi_hit: true, sub_zone: "x" } },
    ];
  }
}

describe("useMapStats — starvation watchdog", () => {
  let fake: FakeMap;
  beforeEach(() => {
    vi.useFakeTimers();
    fake = new FakeMap();
    // The hook reads the map via getMap(), which `setMap` wires up.
    setMap(fake as unknown as never);
  });
  afterEach(() => {
    setMap(null);
    vi.useRealTimers();
  });

  it("does not starve when moveend fires faster than the debounce", () => {
    const { result, unmount } = renderHook(() => useMapStats());
    // First compute happens synchronously on attach — clear it.
    const baselineCalls = fake.queryCalls;
    expect(baselineCalls).toBeGreaterThanOrEqual(1);

    // Fire moveend every 50 ms for 2 seconds — under the old behavior
    // (debounce reset on every event), compute would never run.
    const TOTAL_MS = 2000;
    const STEP_MS = 50;
    for (let elapsed = 0; elapsed < TOTAL_MS; elapsed += STEP_MS) {
      act(() => {
        fake.emit("moveend");
        vi.advanceTimersByTime(STEP_MS);
      });
    }
    // Watchdog should have forced at least one extra compute beyond the
    // initial attach call.
    expect(fake.queryCalls).toBeGreaterThan(baselineCalls);
    expect(result.current).not.toBeNull();
    unmount();
  });

  it("does not subscribe to sourcedata anymore", () => {
    const { unmount } = renderHook(() => useMapStats());
    // The fake map is a strict event bus — only events the hook actually
    // subscribed to are present in the handlers map.
    // Internal access for the assertion only.
    const handlers = (fake as unknown as { handlers: Map<string, Set<Handler>> }).handlers;
    expect(handlers.has("sourcedata")).toBe(false);
    expect(handlers.has("moveend")).toBe(true);
    expect(handlers.has("idle")).toBe(true);
    unmount();
  });
});
