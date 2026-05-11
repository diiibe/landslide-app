import { beforeEach, describe, expect, it, vi } from "vitest";
import { addCriticalPoi, uninstallIconLoader } from "./criticalPoi";

// `addCriticalPoi` fires a background fetch for the POI GeoJSON. In jsdom
// the relative URL can't be resolved, so stub fetch to a benign empty
// FeatureCollection — keeps unhandled-rejection noise out of the report
// without changing what we're testing (the handler lifecycle).
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ type: "FeatureCollection", features: [] }),
    })),
  );
});

/**
 * P1.13: the `styleimagemissing` handler must be registered per-map
 * instance, not gated by a single module-level flag. After `setStyle()`
 * MapLibre wipes registered images; our MapView responds by re-running
 * `addCriticalPoi` on `style.load`. A stale module-level flag would
 * cause the handler not to be re-bound, leaving icons as default
 * missing-image dots.
 */

interface FakeListener {
  type: string;
  fn: (e: { id: string }) => void;
}

function makeFakeMap() {
  const listeners: FakeListener[] = [];
  const layers = new Set<string>();
  const sources = new Set<string>();
  const m = {
    on: vi.fn((type: string, fn: (e: { id: string }) => void) => {
      listeners.push({ type, fn });
    }),
    off: vi.fn((type: string, fn: (e: { id: string }) => void) => {
      const idx = listeners.findIndex((l) => l.type === type && l.fn === fn);
      if (idx >= 0) listeners.splice(idx, 1);
    }),
    getLayer: vi.fn((id: string) => (layers.has(id) ? { id } : undefined)),
    removeLayer: vi.fn((id: string) => layers.delete(id)),
    getSource: vi.fn((id: string) =>
      sources.has(id) ? { id, setData: vi.fn() } : undefined,
    ),
    removeSource: vi.fn((id: string) => sources.delete(id)),
    // `getSource` returns an object with `setData` so the background
    // `loadPoi().then(...)` doesn't blow up the test runner with an
    // unhandled rejection after the resolved fetch.
    addSource: vi.fn((id: string) => sources.add(id)),
    addLayer: vi.fn((spec: { id: string }) => layers.add(spec.id)),
    hasImage: vi.fn(() => false),
    addImage: vi.fn(),
    setLayoutProperty: vi.fn(),
    setPaintProperty: vi.fn(),
  };
  return { m, listeners };
}

describe("criticalPoi · styleimagemissing handler lifecycle", () => {
  it("binds the handler on each new map instance (simulates setStyle re-init)", () => {
    const fake1 = makeFakeMap();
    addCriticalPoi(fake1.m as never, true, false);
    const styleListenersOn1 = fake1.listeners.filter(
      (l) => l.type === "styleimagemissing",
    );
    expect(styleListenersOn1).toHaveLength(1);

    // Simulate `setStyle()` clearing the map's image cache: in production,
    // MapView re-creates the map (or re-fires `style.load`) and we call
    // `addCriticalPoi` again. With a module-level boolean flag this second
    // call would be skipped → icons render as default missing dots.
    const fake2 = makeFakeMap();
    addCriticalPoi(fake2.m as never, true, false);
    const styleListenersOn2 = fake2.listeners.filter(
      (l) => l.type === "styleimagemissing",
    );
    expect(styleListenersOn2).toHaveLength(1);
  });

  it("is idempotent: calling addCriticalPoi twice on the same map binds the handler once", () => {
    const fake = makeFakeMap();
    addCriticalPoi(fake.m as never, true, false);
    addCriticalPoi(fake.m as never, true, false);
    const styleListeners = fake.listeners.filter(
      (l) => l.type === "styleimagemissing",
    );
    expect(styleListeners).toHaveLength(1);
  });

  it("uninstallIconLoader removes the listener and allows a fresh bind afterwards", () => {
    const fake = makeFakeMap();
    addCriticalPoi(fake.m as never, true, false);
    expect(
      fake.listeners.filter((l) => l.type === "styleimagemissing"),
    ).toHaveLength(1);

    uninstallIconLoader(fake.m as never);
    expect(
      fake.listeners.filter((l) => l.type === "styleimagemissing"),
    ).toHaveLength(0);

    // After uninstall, a subsequent call must re-bind.
    addCriticalPoi(fake.m as never, true, false);
    expect(
      fake.listeners.filter((l) => l.type === "styleimagemissing"),
    ).toHaveLength(1);
  });
});
