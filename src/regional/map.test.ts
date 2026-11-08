import { afterEach, it, expect, vi } from "vitest";
import type { Map as MLMap } from "maplibre-gl";
import { mountRegionalMap } from "./map";
import { useRegionalStore } from "./store";
import type { LayerDefinition } from "./types";
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
afterEach(() => {
  cleanup?.();
  useRegionalStore.setState({ catalog: null, enabled: {}, entries: {} });
});
function harness(layer: LayerDefinition) {
  useRegionalStore.setState({
    enabled: { sample: true },
    entries: {},
    catalog: { generatedAt: "2026-01-01", layers: [layer] },
  });
  const callbacks = new Map<string, () => void>(),
    sources = new Map<string, Record<string, unknown>>(),
    layers = new Map<string, { id: string }>();
  const addSource = vi.fn((id: string, s: Record<string, unknown>) =>
    sources.set(
      id,
      s.type === "geojson" ? { ...s, setData: vi.fn() } : { ...s },
    ),
  );
  const map = {
    on: (s: string, f: () => void) => callbacks.set(s, f),
    off: vi.fn(),
    getStyle: () => ({ layers: [...layers.values()] }),
    getSource: (id: string) => sources.get(id),
    getLayer: (id: string) => layers.get(id),
    addSource,
    addLayer: (l: { id: string }) => layers.set(l.id, l),
    removeLayer: (id: string) => layers.delete(id),
    removeSource: (id: string) => sources.delete(id),
    setFilter: vi.fn(),
    setPaintProperty: vi.fn(),
  };
  cleanup = mountRegionalMap(map as unknown as MLMap);
  callbacks.get("style.load")!();
  return { sources, addSource };
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
