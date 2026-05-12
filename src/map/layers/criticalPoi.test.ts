import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addCriticalPoi, uninstallIconLoader } from "./criticalPoi";

/**
 * POI renderer used to draw SDF symbol icons + cache them through a
 * styleimagemissing listener. It now draws three stacked circle layers
 * per group (glow + halo + core) and animates the radii via a
 * requestAnimationFrame loop. The legacy P1.13 tests for the icon-loader
 * lifecycle were dropped along with the loader itself; what we still
 * care about is:
 *   1. `addCriticalPoi` adds three layers per group.
 *   2. `uninstallIconLoader` is safe to call any number of times.
 */

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ type: "FeatureCollection", features: [] }),
    })),
  );
  // jsdom doesn't ship requestAnimationFrame by default in older
  // environments; vitest provides it but stub it explicitly to avoid
  // background ticks bleeding into other tests.
  vi.stubGlobal("requestAnimationFrame", vi.fn(() => 0));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function makeFakeMap() {
  const layers = new Set<string>();
  const sources = new Set<string>();
  return {
    on: vi.fn(),
    off: vi.fn(),
    getLayer: vi.fn((id: string) => (layers.has(id) ? { id } : undefined)),
    removeLayer: vi.fn((id: string) => layers.delete(id)),
    getSource: vi.fn((id: string) =>
      sources.has(id) ? { id, setData: vi.fn() } : undefined,
    ),
    removeSource: vi.fn((id: string) => sources.delete(id)),
    addSource: vi.fn((id: string) => sources.add(id)),
    addLayer: vi.fn((spec: { id: string }) => layers.add(spec.id)),
    setLayoutProperty: vi.fn(),
    setPaintProperty: vi.fn(),
    layers,
  };
}

describe("criticalPoi · gaussian-balls renderer", () => {
  it("adds three circle layers per group (glow, halo, core)", () => {
    const m = makeFakeMap();
    addCriticalPoi(m as never, true, true);
    for (const group of ["critical", "huts"] as const) {
      for (const tier of ["glow", "halo", "core"] as const) {
        expect(m.layers.has(`poi-${group}-${tier}`)).toBe(true);
      }
    }
  });

  it("uninstallIconLoader is a safe no-op (legacy contract preserved)", () => {
    const m = makeFakeMap();
    addCriticalPoi(m as never, false, false);
    expect(() => uninstallIconLoader()).not.toThrow();
    expect(() => uninstallIconLoader()).not.toThrow();
  });
});
