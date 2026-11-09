import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Map as MLMap } from "maplibre-gl";
import { mountTwinMap, SCENES } from "./map";
import { useTwinStore } from "./store";
import { useAppStore } from "@/app/store";

let dispose: (() => void) | undefined;
beforeEach(() => {
  useTwinStore.setState({
    active: false,
    measures: [],
    radar: null,
    variable: "wind",
    selection: null,
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn(() => 1),
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.spyOn(globalThis, "fetch").mockImplementation(
    async () =>
      new Response(JSON.stringify({ type: "FeatureCollection", features: [] })),
  );
});
afterEach(() => {
  dispose?.();
  useTwinStore.setState({ active: false });
  document.getElementById("drawer-panel")?.remove();
  useAppStore.getState().reset();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function harness() {
  const frames = new Map<number, FrameRequestCallback>();
  let frameId = 0,
    flying = false;
  let padding = { top: 0, right: 0, bottom: 0, left: 0 };
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++frameId, callback);
    return frameId;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  const container = document.createElement("div");
  container.getBoundingClientRect = () => ({
    x: 0,
    y: 0,
    width: 390,
    height: 700,
    top: 0,
    bottom: 700,
    left: 0,
    right: 390,
    toJSON: () => ({}),
  });
  Object.defineProperties(container, {
    clientWidth: { value: 390 },
    clientHeight: { value: 700 },
  });
  const canvas = { clientWidth: 390, clientHeight: 164, style: { cursor: "" } };
  const handlers = new Map<string, () => void>();
  const sources = new Map<string, { setData: ReturnType<typeof vi.fn> }>();
  const layers = new Map<string, unknown>();
  const paint = vi.fn(),
    jumpTo = vi.fn();
  const flyTo = vi.fn(() => {
    flying = true;
  });
  const fitBounds = vi.fn(() => {
    flying = true;
  });
  const map = {
    getContainer: () => container,
    getCanvas: () => canvas,
    resize: vi.fn(() => {
      canvas.clientWidth = 390;
      canvas.clientHeight = 700;
      flying = false;
    }),
    getStyle: () => ({ layers: [] }),
    on: (event: string, handler: () => void) => handlers.set(event, handler),
    off: (event: string) => handlers.delete(event),
    getCenter: () => ({ lng: 13.15, lat: 46.35 }),
    getZoom: () => 10,
    getPitch: () => 0,
    getBearing: () => 0,
    getPadding: () => padding,
    setPadding: (next: typeof padding) => {
      padding = next;
      flying = false;
    },
    flyTo,
    fitBounds,
    jumpTo,
    setPaintProperty: paint,
    setLayoutProperty: vi.fn(),
    getSource: (id: string) => sources.get(id),
    addSource: (id: string) => sources.set(id, { setData: vi.fn() }),
    getLayer: (id: string) => layers.get(id),
    addLayer: (layer: { id: string }) => layers.set(layer.id, layer),
  };
  dispose = mountTwinMap(map as unknown as MLMap);
  return {
    paint,
    jumpTo,
    flyTo,
    fitBounds,
    canvas,
    resize: map.resize,
    isFlying: () => flying,
    getPadding: () => padding,
    drain: () => {
      for (let n = 0; frames.size && n < 20; n++) {
        const batch = [...frames];
        frames.clear();
        for (const [, callback] of batch) callback(n * 16);
      }
    },
    emit: (event: string) => handlers.get(event)?.(),
  };
}
it("suspends twin writes during style replacement and resumes without resetting the scene", () => {
  const h = harness();
  h.emit("style.load");
  useTwinStore.setState({ active: true });
  window.dispatchEvent(
    new CustomEvent("fvg:twin-scene", { detail: "trieste" }),
  );
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
  window.dispatchEvent(
    new CustomEvent("fvg:twin-scene", { detail: "monfalcone" }),
  );
  h.emit("style.load");
  expect(h.jumpTo).toHaveBeenCalledWith(
    expect.objectContaining({ center: SCENES.monfalcone.center }),
  );
});
it("preserves the current region when observations activate during a style load", () => {
  const h = harness();
  h.emit("style.load");
  h.emit("styledataloading");
  useTwinStore.setState({ active: true });
  h.emit("style.load");
  expect(h.jumpTo).not.toHaveBeenCalled();
});

it("applies the closed sheet inset before flying or fitting, so a later layout frame cannot cancel navigation", () => {
  const panel = document.createElement("aside");
  panel.id = "drawer-panel";
  panel.style.position = "absolute";
  panel.getBoundingClientRect = () => ({
    x: 0,
    y: 266,
    width: 390,
    height: 434,
    top: 266,
    bottom: 700,
    left: 0,
    right: 390,
    toJSON: () => ({}),
  });
  document.body.append(panel);
  const h = harness();
  h.emit("style.load");
  const sample = {
    stationId: 212,
    sensorId: 6,
    name: "Trieste",
    lon: 13.75,
    lat: 45.65,
    value: 3,
    time: "2026-11-08 18:00:00",
    ms: Date.UTC(2026, 10, 8, 18),
  };
  useAppStore.setState({ drawerOpen: true });
  useTwinStore.setState({
    active: true,
    measures: [sample, { ...sample, stationId: 213, lon: 13.5 }],
  });
  h.drain();
  expect(h.getPadding().bottom).toBe(434);
  expect(h.canvas.clientHeight).toBe(700);
  expect(h.resize).toHaveBeenCalledTimes(1);
  window.dispatchEvent(new CustomEvent("fvg:twin-station", { detail: 212 }));
  useAppStore.setState({ drawerOpen: false });
  h.drain();
  expect(h.flyTo).toHaveBeenCalledWith(
    expect.objectContaining({ center: [13.75, 45.65] }),
  );
  expect(h.getPadding().bottom).toBe(0);
  expect(h.isFlying()).toBe(true);
  useAppStore.setState({ drawerOpen: true });
  h.drain();
  window.dispatchEvent(new CustomEvent("fvg:twin-fit"));
  useAppStore.setState({ drawerOpen: false });
  h.drain();
  expect(h.fitBounds).toHaveBeenCalledWith(
    expect.any(Array),
    expect.objectContaining({ padding: 24 }),
  );
  expect(h.isFlying()).toBe(true);
});

it("releases and restores the drawer inset during drawing without resizing the canvas or changing the drawer preference", () => {
  const panel = document.createElement("aside");
  panel.id = "drawer-panel";
  panel.style.position = "absolute";
  panel.getBoundingClientRect = () => ({
    x: 0,
    y: 266,
    width: 390,
    height: 434,
    top: 266,
    bottom: 700,
    left: 0,
    right: 390,
    toJSON: () => ({}),
  });
  document.body.append(panel);
  const h = harness();
  h.emit("style.load");
  useTwinStore.setState({ active: true });
  useAppStore.setState({ drawerOpen: true, drawingMode: false });
  h.drain();
  expect(h.getPadding().bottom).toBe(434);
  const resizes = h.resize.mock.calls.length;
  useAppStore.setState({ drawingMode: true });
  h.drain();
  expect(h.getPadding().bottom).toBe(0);
  expect(useAppStore.getState().drawerOpen).toBe(true);
  useAppStore.setState({ drawingMode: false });
  h.drain();
  expect(h.getPadding().bottom).toBe(434);
  expect(h.resize).toHaveBeenCalledTimes(resizes);
});
