import { describe, expect, it } from "vitest";
import type { Map as MLMap } from "maplibre-gl";
import {
  setModelV2Visible,
  v2ClassColor,
  v2LayerIds,
  V2_LAYER_ID,
  V2_RASTER_LAYER_ID,
  V2_VECTOR_MIN_ZOOM,
} from "./modelV2";
import { RAMP_STOPS } from "../style";

/** Just enough of the MapLibre map API for the v2 layer helpers. */
function fakeMap() {
  const sources = new Map<string, Record<string, unknown>>();
  const layers = new Map<string, Record<string, unknown>>();
  const order: string[] = [];
  const visibility = new Map<string, string>();
  const m = {
    getSource: (id: string) => sources.get(id),
    addSource: (id: string, spec: Record<string, unknown>) =>
      void sources.set(id, spec),
    getLayer: (id: string) => layers.get(id),
    addLayer: (spec: Record<string, unknown>, before?: string) => {
      layers.set(spec.id as string, spec);
      const at = before ? order.indexOf(before) : -1;
      if (at >= 0) order.splice(at, 0, spec.id as string);
      else order.push(spec.id as string);
    },
    setFilter: (id: string, filter: unknown) => {
      layers.get(id)!.filter = filter;
    },
    setPaintProperty: (id: string, key: string, value: unknown) => {
      (layers.get(id)!.paint as Record<string, unknown>)[key] = value;
    },
    removeLayer: (id: string) => layers.delete(id),
    removeSource: (id: string) => sources.delete(id),
    setLayoutProperty: (id: string, _k: string, v: string) =>
      void visibility.set(id, v),
  };
  return { m: m as unknown as MLMap, sources, layers, order, visibility };
}

describe("model v2 map layers", () => {
  it("applies the same class cutoff and opacity at regional and detailed zooms", () => {
    const f = fakeMap();
    setModelV2Visible(f.m, "bodies", true, undefined, {
      minClass: 3,
      opacity: 0.4,
    });
    expect(f.layers.get(V2_LAYER_ID.bodies)!.filter).toEqual([
      ">=",
      ["get", "cls"],
      3,
    ]);
    expect(String(f.sources.get("v2-bodies-raster-src")!.url)).toContain(
      "_min3.pmtiles",
    );
    setModelV2Visible(f.m, "bodies", true, undefined, {
      minClass: 5,
      opacity: 0.25,
    });
    expect(String(f.sources.get("v2-bodies-raster-src")!.url)).toContain(
      "_min5.pmtiles",
    );
    expect(
      (f.layers.get(V2_LAYER_ID.bodies)!.paint as Record<string, unknown>)[
        "fill-opacity"
      ],
    ).toBe(0.25);
    expect(
      (
        f.layers.get(V2_RASTER_LAYER_ID.bodies)!.paint as Record<
          string,
          unknown
        >
      )["raster-opacity"],
    ).toBe(0.25);
  });
  it("draws z6-9 from the raster pyramid and z10+ from the vector cells", () => {
    const f = fakeMap();
    setModelV2Visible(f.m, "bodies", true);
    const raster = f.layers.get(V2_RASTER_LAYER_ID.bodies)!;
    const vector = f.layers.get(V2_LAYER_ID.bodies)!;
    expect(V2_VECTOR_MIN_ZOOM).toBe(10);
    expect(raster.type).toBe("raster");
    expect(raster.maxzoom).toBe(V2_VECTOR_MIN_ZOOM);
    expect(vector.minzoom).toBe(V2_VECTOR_MIN_ZOOM);
    // Classes must never blend when a z9 tile is stretched between zooms.
    expect((raster.paint as Record<string, unknown>)["raster-resampling"]).toBe(
      "nearest",
    );
    expect(String(f.sources.get(raster.source as string)!.url)).toMatch(
      /tiles\/v2_bodies_raster\.pmtiles\?palette=red-v1$/,
    );
    expect(String(f.sources.get(vector.source as string)!.url)).toMatch(
      /tiles\/v2_bodies\.pmtiles$/,
    );
  });

  it("switches the raster and vector halves of a layer exactly together", () => {
    const f = fakeMap();
    setModelV2Visible(f.m, "diffuse", true);
    const ids = v2LayerIds("diffuse");
    expect(ids.map((id) => f.visibility.get(id))).toEqual([
      "visible",
      "visible",
    ]);
    setModelV2Visible(f.m, "diffuse", false);
    expect(ids.map((id) => f.visibility.get(id))).toEqual(["none", "none"]);
  });

  it("adds nothing while a layer stays off", () => {
    const f = fakeMap();
    setModelV2Visible(f.m, "bodies", false);
    expect(f.layers.size).toBe(0);
    expect(f.sources.size).toBe(0);
  });

  it("places both halves below the given layer", () => {
    const f = fakeMap();
    f.m.addLayer({ id: "iffi-fill", type: "fill", source: "x" } as never);
    setModelV2Visible(f.m, "bodies", true, "iffi-fill");
    expect(f.order).toEqual([
      V2_RASTER_LAYER_ID.bodies,
      V2_LAYER_ID.bodies,
      "iffi-fill",
    ]);
  });

  it("colours five classes on the five ramp stops, like the raster palette", () => {
    expect([1, 2, 3, 4, 5].map((c) => v2ClassColor(c, 5))).toEqual(
      RAMP_STOPS.map(([, c]) => c),
    );
  });
});
