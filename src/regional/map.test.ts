import { beforeEach, afterEach, it, expect, vi } from "vitest";
import type { Map as MLMap } from "maplibre-gl";
import { mountRegionalMap } from "./map";
import { useRegionalStore } from "./store";
import type { LayerDefinition } from "./types";
const popupNodes = vi.hoisted(() => [] as HTMLElement[]);
vi.mock("maplibre-gl", () => ({ Popup: class {
  setLngLat() { return this; }
  setDOMContent(node: HTMLElement) { popupNodes.push(node); return this; }
  addTo() { return this; }
  remove() { return this; }
} }));
const base: LayerDefinition = {
  id: "sample",
  title: "Campione",
  folder: "servizi",
  description: "",
  note: "",
  sourceId: "sample",
  sourceUrl: "https://example.com",
  provider: "Regione",
  license: "IODL2",
  licenseUrl: "https://example.com",
  cadence: "",
  color: "#111111",
  status: "ready",
  kind: "vector",
  file: "sample.pmtiles",
  retrievedAt: "2026-01-01",
};
let cleanup: (() => void) | undefined;
beforeEach(() => { vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false }))); });
afterEach(() => {
  vi.unstubAllGlobals();
  cleanup?.();
  useRegionalStore.setState({ catalog: null, enabled: {}, entries: {} });
});
function harness(layer: LayerDefinition) {
  useRegionalStore.setState({
    enabled: { sample: true },
    entries: layer.kind === "geojson" ? { sample: {loading:false,error:null,snapshot:false,data:{type:"FeatureCollection",features:[]}} } : {},
    display: {},
    selection: null,
    catalog: { generatedAt: "2026-01-01", layers: [layer] },
  });
  const callbacks = new Map<string, (...args: unknown[]) => void>(),
    sources = new Map<string, Record<string, unknown>>(),
    layers = new Map<string, { id: string }>();
  const addSource = vi.fn((id: string, s: Record<string, unknown>) =>
    sources.set(
      id,
      s.type === "geojson" ? { ...s, setData: vi.fn() } : { ...s },
    ),
  );
  const map = {
    on: (s: string, f: (...args: unknown[]) => void) => callbacks.set(s, f),
    off: vi.fn(),
    getStyle: () => ({ layers: [...layers.values()] }),
    getSource: (id: string) => sources.get(id),
    getLayer: (id: string) => layers.get(id),
    addSource,
    hasImage: () => true,
    addImage: vi.fn(),
    getCanvas: () => ({style:{cursor:""}}),
    project: () => ({x:100,y:100}),
    isMoving: () => false,
    queryRenderedFeatures: vi.fn(),
    getZoom: () => 10.8,
    easeTo: vi.fn(),
    addLayer: (l: { id: string }) => layers.set(l.id, l),
    removeLayer: (id: string) => layers.delete(id),
    removeSource: (id: string) => sources.delete(id),
    setFilter: vi.fn(),
    setPaintProperty: vi.fn(),
  };
  cleanup = mountRegionalMap(map as unknown as MLMap);
  callbacks.get("style.load")!();
  return { sources, addSource, callbacks, map };
}
it("rebuilds a vector source as GeoJSON when an automatic refresh crosses the file-size threshold", () => {
  const h = harness(base);
  expect(h.sources.get("regional-sample")?.type).toBe("vector");
  expect(() =>
    useRegionalStore.setState({
      catalog: {
        generatedAt: "2026-01-02",
        layers: [
          {
            ...base,
            kind: "geojson",
            file: "sample.geojson",
            retrievedAt: "2026-01-02",
          },
        ],
      },
      entries: {
        sample: {
          loading: false,
          error: null,
          snapshot: true,
          data: { type: "FeatureCollection", features: [] },
        },
      },
    }),
  ).not.toThrow();
  expect(h.sources.get("regional-sample")?.type).toBe("geojson");
});
it("preserves literal raster template variables and clips requests to available bounds", () => {
  const h = harness({
    ...base,
    kind: "raster",
    tiles: ["data/regional/raster-sample/{z}/{x}/{y}.png"],
    bounds: [
      [12, 45],
      [14, 47],
    ],
  });
  expect(h.sources.get("regional-sample")?.tiles).toEqual([
    expect.stringContaining("/{z}/{x}/{y}.png"),
  ]);
  expect(h.sources.get("regional-sample")?.bounds).toEqual([12, 45, 14, 47]);
});

it("refreshes mirrored raster tile URLs on a catalog update even when the oldest acquisition date stays unchanged", () => {
  const layer = {
    ...base,
    kind: "raster" as const,
    tiles: ["data/regional/raster-sample/{z}/{x}/{y}.png"],
  };
  const h = harness(layer);
  const before = h.sources.get("regional-sample")?.tiles;
  useRegionalStore.setState({
    catalog: { generatedAt: "2026-01-02", layers: [layer] },
  });
  const after = h.sources.get("regional-sample")?.tiles;
  expect(after).not.toEqual(before);
  expect(after).toEqual([expect.stringContaining("?v=2026-01-02")]);
  expect(
    h.addSource.mock.calls.filter(([id]) => id === "regional-sample"),
  ).toHaveLength(2);
});

it("refreshes the overview source when a GeoJSON acquisition changes with unchanged counts", () => {
  const layer: LayerDefinition = {...base, kind:"geojson", overview:{file:"overview-sample.geojson",count:1,sourceCount:1,kind:"areas"}};
  const h=harness(layer);
  expect(h.sources.get("regional-sample-overview-source")?.data).toContain("2026-01-01");
  useRegionalStore.setState({catalog:{generatedAt:"2026-01-02",layers:[{...layer,retrievedAt:"2026-01-02"}]}});
  expect(h.sources.get("regional-sample-overview-source")?.data).toContain("2026-01-02");
});
it("advances beyond overview scale on tap even if source bounds cover a broad area", () => {
  const h=harness({...base,overview:{file:"overview-sample.geojson",count:10,sourceCount:10,kind:"areas"}});
  h.map.queryRenderedFeatures.mockReturnValue([{type:"Feature",layer:{id:"regional-sample-overview"},geometry:{type:"Point",coordinates:[13.3,45.85]},properties:{__overview:true,__count:10,__bounds:"[13.1,45.8,13.44,45.9]"}}]);
  h.callbacks.get("click")!({point:{x:100,y:100},lngLat:{lng:13.3,lat:45.85}});
  expect(h.map.easeTo).toHaveBeenCalledWith(expect.objectContaining({center:[13.3,45.85],zoom:expect.any(Number)}));
  expect(h.map.easeTo.mock.calls[0]![0].zoom).toBeGreaterThan(11);
  expect(useRegionalStore.getState().selection).toBeNull();
});
it("refreshes the hover content between overview groups with no provider feature id", () => {
 const h=harness({...base,overview:{file:"overview-sample.geojson",count:10,sourceCount:10,kind:"areas"}});
 const clock=vi.spyOn(performance,"now");
 for(const [index,count] of [2,8].entries()) {
  clock.mockReturnValue(1000+index*100);
  h.map.queryRenderedFeatures.mockReturnValue([{type:"Feature",layer:{id:"regional-sample-overview"},geometry:{type:"Point",coordinates:[13.3,45.85]},properties:{__overview:true,__count:count,__bounds:JSON.stringify([13+index,45.8,13.4+index,45.9])}}]);
  h.callbacks.get("mousemove")!({point:{x:100,y:100},lngLat:{lng:13.3,lat:45.85}});
 }
 expect(popupNodes.at(-1)?.textContent).toContain("8 record");clock.mockRestore();
});
