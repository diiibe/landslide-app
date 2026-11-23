import { afterEach, expect, it, vi } from "vitest";
import { validateStyleMin } from "@maplibre/maplibre-gl-style-spec";
import type { Map as MLMap, StyleSpecification } from "maplibre-gl";
import { mountAirMap } from "./map";
import { adoptAirData, setAirLayer, setAirOpacity, useAirStore } from "./store";
import { useExperienceStore } from "../store";
import { useAppStore } from "@/app/store";
import { airFixture, contextFixture, worldFixture } from "./testFixtures";
afterEach(() => {
  useExperienceStore.setState({ activeId: null });
  vi.unstubAllGlobals();
});
it("keeps real values, opacity, categories and lifecycle consistent through style changes", () => {
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  useExperienceStore.setState({ activeId: "air" });
  useAirStore.setState({
    ...useAirStore.getInitialState(),
    context: contextFixture,
    world: worldFixture,
  });
  adoptAirData(airFixture());
  const sources = new Map<string, Record<string, unknown>>(),
    layers = new Map<string, Record<string, unknown>>(),
    handlers = new Map<string, Set<(...args: unknown[]) => void>>();
  let writes = 0;
  const map = {
    isStyleLoaded: () => true,
    getSource: (id: string) => sources.get(id),
    getLayer: (id: string) => layers.get(id),
    addSource: (id: string, spec: Record<string, unknown>) =>
      sources.set(id, {
        ...spec,
        setData: (data: unknown) => {
          writes++;
          sources.get(id)!.data = data;
        },
      }),
    removeSource: (id: string) => sources.delete(id),
    addLayer: (spec: Record<string, unknown>) =>
      layers.set(spec.id as string, spec),
    removeLayer: (id: string) => layers.delete(id),
    moveLayer: vi.fn(),
    setLayoutProperty: (id: string, k: string, v: unknown) => {
      const l = layers.get(id)!;
      l.layout = { ...((l.layout as object) ?? {}), [k]: v };
    },
    getLayoutProperty: (id: string, k: string) =>
      (layers.get(id)?.layout as Record<string, unknown> | undefined)?.[k],
    setPaintProperty: (id: string, k: string, v: unknown) => {
      const l = layers.get(id)!;
      l.paint = { ...((l.paint as object) ?? {}), [k]: v };
    },
    on: (type: string, fn: (...args: unknown[]) => void) => {
      if (!handlers.has(type)) handlers.set(type, new Set());
      handlers.get(type)!.add(fn);
    },
    off: (type: string, fn: (...args: unknown[]) => void) =>
      handlers.get(type)?.delete(fn),
  };
  const stop = mountAirMap(map as unknown as MLMap);
  const style = {
    version: 8,
    glyphs: "https://example.com/{fontstack}/{range}.pbf",
    sources: Object.fromEntries(
      [...sources].map(([id, s]) => {
        const { setData, ...spec } = s;
        void setData;
        return [id, spec];
      }),
    ),
    layers: [...layers.values()],
  } as unknown as StyleSpecification;
  expect(validateStyleMin(style).map((e) => e.message)).toEqual([]);
  const rows = (sources.get("air-stations")?.data as GeoJSON.FeatureCollection)
    .features;
  expect(rows[0]?.properties).toMatchObject({ value: 20, id: "A" });
  expect(rows[0]?.properties?.label).toContain("PM10 20");
  expect(rows[0]?.properties?.label).toContain("PM2.5 —");
  useAirStore.setState({ aiaCategory: "waste" });
  const aia = (sources.get("air-aia")?.data as GeoJSON.FeatureCollection)
    .features;
  expect(aia).toHaveLength(1);
  expect(aia[0]?.properties?.color).toBe("#b17630");
  setAirLayer("aia", true);
  setAirOpacity("aia", 0);
  expect(layers.get("air-aia-point")?.paint).toMatchObject({
    "circle-opacity": 0,
    "circle-stroke-opacity": 0,
  });
  expect(layers.get("air-aia-heat")?.paint).toMatchObject({
    "heatmap-opacity": 0,
  });
  setAirOpacity("inventory", 0);
  expect(layers.get("air-inventory-line")?.paint).toMatchObject({
    "line-opacity": 0,
  });
  expect(layers.get("air-inventory-3d")?.paint).toMatchObject({
    "fill-extrusion-opacity": 0,
  });
  const before = writes;
  useAirStore.setState({ loading: true });
  expect(writes).toBe(before);
  handlers.get("styledataloading")?.forEach((fn) => fn());
  layers.clear();
  sources.clear();
  handlers.get("style.load")?.forEach((fn) => fn());
  expect(layers.has("air-station-label")).toBe(true);
  expect(sources.has("air-world")).toBe(true);
  useExperienceStore.setState({ activeId: "traffic" });
  expect(layers.size).toBe(0);
  expect(sources.size).toBe(0);
  useExperienceStore.setState({ activeId: "air" });
  expect(layers.has("air-inventory-fill")).toBe(true);
  useAppStore.setState({ drawingMode: true });
  stop();
  expect(layers.size).toBe(0);
  expect([...handlers.values()].every((v) => v.size === 0)).toBe(true);
  useAppStore.setState({ drawingMode: false });
});
