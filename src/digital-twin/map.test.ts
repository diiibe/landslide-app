import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Map as MLMap } from "maplibre-gl";
import { mountTwinMap, SCENES } from "./map";
import { useTwinStore } from "./store";

let dispose: (() => void) | undefined;
beforeEach(() => {
  useTwinStore.setState({ active: false, measures: [], radar: null, variable: "wind", selection: null });
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(JSON.stringify({ type: "FeatureCollection", features: [] })));
});
afterEach(() => {
  dispose?.();
  useTwinStore.setState({ active: false });
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function harness() {
  const handlers = new Map<string, () => void>();
  const sources = new Map<string, { setData: ReturnType<typeof vi.fn> }>();
  const layers = new Map<string, unknown>();
  const paint = vi.fn(), jumpTo = vi.fn();
  const map = {
    getContainer: () => document.createElement("div"),
    getStyle: () => ({ layers: [] }),
    on: (event: string, handler: () => void) => handlers.set(event, handler),
    off: (event: string) => handlers.delete(event),
    getCenter: () => ({ lng: 13.15, lat: 46.35 }),
    getZoom: () => 10, getPitch: () => 0, getBearing: () => 0,
    getPadding: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    jumpTo, setPaintProperty: paint, setLayoutProperty: vi.fn(),
    getSource: (id: string) => sources.get(id),
    addSource: (id: string) => sources.set(id, { setData: vi.fn() }),
    getLayer: (id: string) => layers.get(id),
    addLayer: (layer: { id: string }) => layers.set(layer.id, layer),
  };
  dispose = mountTwinMap(map as unknown as MLMap);
  return { paint, jumpTo, emit: (event: string) => handlers.get(event)?.() };
}
it("suspends twin writes during style replacement and resumes without resetting the scene", () => {
  const h = harness();
  h.emit("style.load");
  useTwinStore.setState({ active: true });
  window.dispatchEvent(new CustomEvent("fvg:twin-scene", { detail: "trieste" }));
  h.emit("styledataloading");
  h.paint.mockClear();
  h.jumpTo.mockClear();
  useTwinStore.setState({ variable: "temperature" });
  expect(h.paint).not.toHaveBeenCalled();
  h.emit("style.load");
  expect(h.paint).toHaveBeenCalled();
  expect(h.jumpTo).not.toHaveBeenCalled();
});
it("keeps activation and a requested city pending until the replacement style is ready", () => {
  const h = harness();
  h.emit("style.load");
  h.emit("styledataloading");
  useTwinStore.setState({ active: true });
  expect(h.jumpTo).not.toHaveBeenCalled();
  window.dispatchEvent(new CustomEvent("fvg:twin-scene", { detail: "monfalcone" }));
  h.emit("style.load");
  expect(h.jumpTo).toHaveBeenCalledWith(expect.objectContaining({ center: SCENES.monfalcone.center }));
});
it("frames the coast when activation occurs during a later style load", () => {
  const h = harness();
  h.emit("style.load");
  h.emit("styledataloading");
  useTwinStore.setState({ active: true });
  h.emit("style.load");
  expect(h.jumpTo).toHaveBeenCalledWith(expect.objectContaining({ center: SCENES.coast.center }));
});
