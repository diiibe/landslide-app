import { expect, it, vi } from "vitest";
import type { Map as MLMap } from "maplibre-gl";
import { mountTrekMap, trekNodes } from "./map";
import { useExperienceStore } from "../store";
import { useAppStore } from "@/app/store";
import { useTrekStore } from "./store";
it("rebuilds on style load, keeps touch targets in pixels, and removes all work on exit", () => {
  vi.useFakeTimers();
  useExperienceStore.setState({
    activeId: "trek",
    selectedId: null,
    replayTime: null,
  });
  const sources = new Map<
      string,
      {
        data: GeoJSON.FeatureCollection;
        setData: (d: GeoJSON.FeatureCollection) => void;
      }
    >(),
    layers = new Map<string, unknown>(),
    handlers = new Map<string, Set<() => void>>(),
    canvas = document.createElement("canvas");
  const map = {
    isStyleLoaded: () => true,
    getCanvas: () => canvas,
    getSource: (id: string) => sources.get(id),
    getLayer: (id: string) => layers.get(id),
    addSource: (id: string, s: { data: GeoJSON.FeatureCollection }) =>
      sources.set(id, {
        data: s.data,
        setData(d) {
          this.data = d;
        },
      }),
    removeSource: (id: string) => sources.delete(id),
    addLayer: (s: { id: string }) => layers.set(s.id, s),
    removeLayer: (id: string) => layers.delete(id),
    setLayoutProperty: () => {},
    on: (name: string, cb: () => void) => {
      if (!handlers.has(name)) handlers.set(name, new Set());
      handlers.get(name)!.add(cb);
    },
    off: (name: string, cb: () => void) => handlers.get(name)?.delete(cb),
  };
  const stop = mountTrekMap(map as unknown as MLMap);
  expect(sources.get("trek-nodes")?.data.features).toHaveLength(8);
  expect(vi.getTimerCount()).toBe(1);
  handlers.get("styledataloading")!.forEach((f) => f());
  layers.clear();
  sources.clear();
  handlers.get("style.load")!.forEach((f) => f());
  expect(layers.size).toBe(7);
  expect(layers.get("trek-hit")).toMatchObject({
    paint: { "circle-radius": 22 },
  });
  useExperienceStore.setState({ activeId: "park" });
  expect(sources.size).toBe(0);
  expect(vi.getTimerCount()).toBe(0);
  stop();
  expect([...handlers.values()].every((s) => s.size === 0)).toBe(true);
  vi.useRealTimers();
});
it("uses stable domain identities for same-position readings and the shared replay instant", () => {
  useExperienceStore.setState({ activeId: "trek", selectedId: "st-106" });
  useAppStore.setState({ drawingMode: false });
  const t = Date.parse("2026-11-11T10:00Z");
  useTrekStore.setState({
    scenario: { mode: "supply", since: t - 20 * 60000 },
  });
  const d = trekNodes(t);
  expect(
    d.features.every((f) => f.properties?.__featureId === f.properties?.id),
  ).toBe(true);
  const f = d.features.find((f) => f.properties?.id === "st-106")!;
  expect(f.properties).toMatchObject({ selected: 1, color: "#e69a63" });
  expect(f.properties?.readingDetail).toContain("Demo");
});
