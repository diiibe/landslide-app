import { beforeEach, afterEach, expect, it, vi } from "vitest";
import type { Map as MLMap, MapGeoJSONFeature } from "maplibre-gl";
import { createExpression } from "@maplibre/maplibre-gl-style-spec";
import { groupedPointReadings, mountPointStacks } from "./pointStacks";
import { useAppStore } from "@/app/store";
import { useRegionalStore } from "./store";

const feature = (variable: string, value: string, depth?: number) => ({
  type: "Feature", source: "twin-sensors-" + variable,
  layer: { id: "twin-sensors-" + variable, type: "circle" },
  geometry: { type: "Point", coordinates: [13, 46] },
  properties: { stationId: 4, variable, label: value, value: 3, ...(depth === undefined ? {} : { __depth: depth }) },
}) as unknown as MapGeoJSONFeature;
function fixture() {
  const events = new Map<string, () => void>();
  let features = [feature("humidity", "65 %"), feature("temperature", "18 °C"), feature("wind", "3 m/s")];
  let zoom = 12;
  const layers = ["humidity", "temperature", "wind"].flatMap(v => [
    { id: "twin-sensors-" + v, type: "circle", source: "twin-sensors-" + v },
    { id: "twin-sensors-" + v + "-labels", type: "symbol", source: "twin-sensors-" + v, minzoom: 9, layout: { "text-field": ["get", "label"] } },
  ]);
  const paint = new Map<string, unknown>();
  const setLayout = vi.fn((id: string, name: string, value: unknown) => {
    const l = layers.find(l => l.id === id)!;
    l.layout = { ...l.layout, [name]: value } as NonNullable<typeof l.layout>;
  });
  const map = {
    getStyle: () => ({ layers }), getLayer: (id: string) => layers.find(l => l.id === id),
    getLayoutProperty: (id: string, key: string) => (layers.find(l => l.id === id)?.layout as Record<string, unknown> | undefined)?.[key],
    setLayoutProperty: setLayout, getPaintProperty: (id: string, key: string) => {
      if (id.endsWith("labels") && key === "circle-opacity") throw new Error("Invalid paint property");
      return paint.get(id + ":" + key) ?? 1;
    }, queryRenderedFeatures: () => features, getZoom: () => zoom,
    on: (e: string, fn: () => void) => events.set(e, fn), off: vi.fn(),
  } as unknown as MLMap;
  function text(variable: string, record = features.find(f => f.properties.variable === variable)!) {
    const expression = map.getLayoutProperty("twin-sensors-" + variable + "-labels", "text-field");
    const compiled = createExpression(expression);
    if (compiled.result === "error") throw new Error(JSON.stringify(compiled.value));
    return compiled.value.evaluate({ zoom }, record as never);
  }
  return { map, events, setLayout, text, paint, setFeatures: (f: MapGeoJSONFeature[]) => features = f, setZoom: (v: number) => zoom = v };
}
beforeEach(() => {
  vi.useFakeTimers();
  useAppStore.setState({ drawingMode: false });
  useRegionalStore.setState({ opacity: {} });
});
afterEach(() => vi.useRealTimers());
it("retains rendering order, distinct depths and every value, deduplicating only repeated rendering", () => {
  const a = feature("wind", "3 m/s"), b = feature("temperature", "18 °C"), deep = feature("temperature", "16 °C", 10);
  const halo = { ...a, layer: { id: "twin-sensors-wind-labels" } } as MapGeoJSONFeature;
  const json = JSON.stringify([a, b, deep]);
  expect([...groupedPointReadings([a, halo, b, deep]).values()][0]).toEqual([a, b, deep]);
  expect(JSON.stringify([a, b, deep])).toBe(json);
});
it("adds lines to the existing numeric label without creating any panel, button or marker", async () => {
  const f = fixture(), before = document.body.innerHTML;
  const dispose = mountPointStacks(f.map); f.events.get("style.load")!();
  await vi.advanceTimersByTimeAsync(190);
  expect(f.text("humidity")).toBe("65 %\n18 °C\n3 m/s");
  expect(f.text("temperature")).toBe(""); expect(f.text("wind")).toBe("");
  expect(document.body.innerHTML).toBe(before);
  const writes = f.setLayout.mock.calls.length; f.events.get("sourcedata")!(); await vi.advanceTimersByTimeAsync(190);
  expect(f.setLayout).toHaveBeenCalledTimes(writes);
  f.setFeatures([feature("temperature", "19 °C"), feature("wind", "5 m/s")]);
  f.events.get("sourcedata")!(); await vi.advanceTimersByTimeAsync(190);
  expect(f.text("temperature")).toBe("19 °C\n5 m/s"); expect(f.text("humidity", feature("humidity", "65 %"))).toBe("65 %");
  // Unrelated stations in the same source retain their original label.
  const other = feature("temperature", "12 °C"); other.properties.stationId = 99;
  expect(f.text("temperature", other)).toBe("12 °C");
  dispose(); expect(f.text("temperature")).toBe("19 °C"); expect(vi.getTimerCount()).toBe(0);
});
it("keeps depth identities separate and restores ordinary labels on opacity, zoom, drawing and style changes", async () => {
  const f = fixture(), shallow = feature("temperature", "18 °C"), deep = feature("temperature", "16 °C", 10);
  f.setFeatures([shallow, deep]); const dispose = mountPointStacks(f.map); f.events.get("style.load")!();
  await vi.advanceTimersByTimeAsync(190);
  expect(f.text("temperature", shallow)).toBe("18 °C\n16 °C · 10 m"); expect(f.text("temperature", deep)).toBe("");
  useRegionalStore.setState({ opacity: { "pcr-temperature": 0 } }); await vi.advanceTimersByTimeAsync(190);
  expect(f.text("temperature", shallow)).toBe("18 °C");
  useRegionalStore.setState({ opacity: {} }); await vi.advanceTimersByTimeAsync(190);
  useAppStore.setState({ drawingMode: true }); expect(f.text("temperature", shallow)).toBe("18 °C");
  useAppStore.setState({ drawingMode: false }); await vi.advanceTimersByTimeAsync(190);
  expect(f.text("temperature", shallow)).toContain("16 °C");
  f.setZoom(8); f.events.get("moveend")!(); await vi.advanceTimersByTimeAsync(190);
  expect(f.text("temperature", shallow)).toBe("18 °C");
  f.setZoom(12); f.events.get("moveend")!(); await vi.advanceTimersByTimeAsync(190);
  f.events.get("styledataloading")!();
  // Simulate the actual fresh style, with original text expressions.
  for (const l of f.map.getStyle().layers) if (l.type === "symbol") f.map.setLayoutProperty(l.id, "text-field", ["get", "label"]);
  f.events.get("style.load")!(); await vi.advanceTimersByTimeAsync(190);
  expect(f.text("temperature", shallow)).toContain("16 °C"); dispose();
});
it("does not include a reading whose original text or point is fully transparent", async () => {
  const f = fixture(); f.paint.set("twin-sensors-temperature-labels:text-opacity", 0);
  const dispose = mountPointStacks(f.map); f.events.get("style.load")!(); await vi.advanceTimersByTimeAsync(190);
  expect(f.text("humidity")).toBe("65 %\n3 m/s"); expect(f.text("temperature")).toBe("18 °C");
  f.paint.set("twin-sensors-wind:circle-opacity", 0); f.events.get("sourcedata")!(); await vi.advanceTimersByTimeAsync(190);
  expect(f.text("humidity")).toBe("65 %"); dispose();
});

it("preserves the regional map formatter, units and censored display strings", async () => {
  const f = fixture();
  const regional = (id: string, raw: string, formatted: string) => ({
    ...feature(id, ""), source: "twin-sensors-" + id,
    properties: { stationId: 4, variable: id, __value: 16.6688, __displayValue: raw, __mapLabel: formatted, __unit: "degC" },
  }) as unknown as MapGeoJSONFeature;
  // The actual regional source spelling exercises its map-label formatter.
  const a = regional("humidity", "16.6688", "16,67"), b = regional("temperature", "<0.01", "<0,01");
  for (const l of f.map.getStyle().layers) if ("source" in l) l.source = String(l.source).replace("twin-sensors-", "regional-");
  a.source = "regional-humidity"; b.source = "regional-temperature";
  f.setFeatures([a, b]); const dispose = mountPointStacks(f.map); f.events.get("style.load")!(); await vi.advanceTimersByTimeAsync(190);
  expect(f.text("humidity", a)).toBe("16,67 degC\n<0,01 degC"); dispose();
});
