import { describe, expect, it } from "vitest";
import {
  CellGridFileSchema,
  ComuneFeatureCollectionSchema,
  CriticalPoiFeatureCollectionSchema,
  RoadsFeatureCollectionSchema,
  ModelV2FileSchema,
  TrailsFeatureCollectionSchema,
  parseOrThrow,
} from "./schemas";

/**
 * Boundary-validation tests. The point isn't to catch every typo a
 * developer can make — zod already does that. The point is to assert
 * that the loader's *boundary* throws on malformed input rather than
 * letting a missing field propagate into a downstream `undefined.length`.
 */
describe("CellGridFileSchema", () => {
  it("accepts a well-formed payload", () => {
    const ok = { step: 0.002, data: [6150, 22750, 0.1, 6151, 22750, 0.2] };
    expect(() => parseOrThrow(CellGridFileSchema, ok, "test")).not.toThrow();
  });

  it("rejects a missing step", () => {
    expect(() => parseOrThrow(CellGridFileSchema, { data: [1, 2, 0.3] }, "test")).toThrow(/step/);
  });

  it("rejects a non-positive step", () => {
    expect(() => parseOrThrow(CellGridFileSchema, { step: 0, data: [] }, "test")).toThrow();
  });

  it("rejects data length not a multiple of 3", () => {
    expect(() =>
      parseOrThrow(CellGridFileSchema, { step: 0.002, data: [1, 2, 0.3, 4] }, "cell_grid"),
    ).toThrow(/multiple of 3/);
  });

  it("rejects non-numeric entries in data", () => {
    expect(() =>
      parseOrThrow(
        CellGridFileSchema,
        { step: 0.002, data: [1, "two" as unknown as number, 3] },
        "cell_grid",
      ),
    ).toThrow();
  });
});

describe("ComuneFeatureCollectionSchema", () => {
  it("accepts a minimal valid FeatureCollection", () => {
    const fc = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "Polygon", coordinates: [] },
          properties: { name: "Trieste", risk_j2: 0.1 },
        },
      ],
    };
    expect(() => parseOrThrow(ComuneFeatureCollectionSchema, fc, "comuni")).not.toThrow();
  });

  it("rejects a wrong top-level type", () => {
    expect(() =>
      parseOrThrow(
        ComuneFeatureCollectionSchema,
        { type: "Feature", features: [] },
        "comuni",
      ),
    ).toThrow();
  });

  it("rejects when features is not an array", () => {
    expect(() =>
      parseOrThrow(
        ComuneFeatureCollectionSchema,
        { type: "FeatureCollection", features: null },
        "comuni",
      ),
    ).toThrow();
  });

  it("preserves unknown properties (passthrough)", () => {
    const fc = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "Polygon", coordinates: [] },
          properties: { name: "X", custom_field: 42 },
        },
      ],
    };
    const parsed = parseOrThrow(ComuneFeatureCollectionSchema, fc, "comuni");
    const props = parsed.features[0]?.properties as Record<string, unknown>;
    expect(props.custom_field).toBe(42);
  });
});

describe("RoadsFeatureCollectionSchema", () => {
  it("accepts an empty FeatureCollection", () => {
    expect(() =>
      parseOrThrow(
        RoadsFeatureCollectionSchema,
        { type: "FeatureCollection", features: [] },
        "roads_fvg.geojson",
      ),
    ).not.toThrow();
  });

  it("accepts a feature with empty properties (as the builder writes)", () => {
    const fc = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "LineString", coordinates: [[13, 46], [13.1, 46.1]] },
          properties: {},
        },
      ],
    };
    expect(() =>
      parseOrThrow(RoadsFeatureCollectionSchema, fc, "roads_fvg.geojson"),
    ).not.toThrow();
  });

  it("rejects a wrong top-level type", () => {
    expect(() =>
      parseOrThrow(
        RoadsFeatureCollectionSchema,
        { type: "Feature", features: [] },
        "roads_fvg.geojson",
      ),
    ).toThrow(/roads_fvg/);
  });

  it("rejects a feature with non-Feature type", () => {
    const fc = {
      type: "FeatureCollection",
      features: [{ type: "Polygon", geometry: {}, properties: {} }],
    };
    expect(() =>
      parseOrThrow(RoadsFeatureCollectionSchema, fc, "roads_fvg.geojson"),
    ).toThrow();
  });

  it("rejects when features is missing", () => {
    expect(() =>
      parseOrThrow(
        RoadsFeatureCollectionSchema,
        { type: "FeatureCollection" },
        "roads_fvg.geojson",
      ),
    ).toThrow();
  });
});

describe("TrailsFeatureCollectionSchema", () => {
  it("accepts a trail feature with OSM-shaped properties", () => {
    const fc = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "LineString", coordinates: [[13, 46], [13.05, 46.05]] },
          properties: { sac_scale: "hiking", trail_visibility: "good" },
        },
      ],
    };
    expect(() =>
      parseOrThrow(TrailsFeatureCollectionSchema, fc, "trails_fvg.geojson"),
    ).not.toThrow();
  });

  it("rejects a wrong top-level type", () => {
    expect(() =>
      parseOrThrow(
        TrailsFeatureCollectionSchema,
        { type: "FeatureCollection", features: "not-an-array" },
        "trails_fvg.geojson",
      ),
    ).toThrow();
  });
});

describe("CriticalPoiFeatureCollectionSchema", () => {
  it("accepts a hospital feature", () => {
    const fc = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [13.78, 45.65] },
          properties: {
            name: "Ospedale di Cattinara",
            category: "hospital",
            group: "critical",
            importance: 6,
            risk_j2: 0.12,
            risk_j3: 0.18,
          },
        },
      ],
    };
    expect(() =>
      parseOrThrow(CriticalPoiFeatureCollectionSchema, fc, "poi_fvg.geojson"),
    ).not.toThrow();
  });

  it("rejects a feature missing category", () => {
    const fc = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [13, 46] },
          properties: { group: "critical", importance: 5 },
        },
      ],
    };
    expect(() =>
      parseOrThrow(CriticalPoiFeatureCollectionSchema, fc, "poi_fvg.geojson"),
    ).toThrow(/category/);
  });

  it("rejects a feature missing group", () => {
    const fc = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [13, 46] },
          properties: { category: "hospital", importance: 5 },
        },
      ],
    };
    expect(() =>
      parseOrThrow(CriticalPoiFeatureCollectionSchema, fc, "poi_fvg.geojson"),
    ).toThrow(/group/);
  });

  it("rejects a wrong top-level type", () => {
    expect(() =>
      parseOrThrow(
        CriticalPoiFeatureCollectionSchema,
        { type: "Wrong", features: [] },
        "poi_fvg.geojson",
      ),
    ).toThrow();
  });
});

describe("parseOrThrow error format", () => {
  it("includes the source name in the thrown error", () => {
    try {
      parseOrThrow(
        RoadsFeatureCollectionSchema,
        { type: "wrong" },
        "roads_fvg.geojson",
      );
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as Error).message).toMatch(/roads_fvg\.geojson failed validation/);
    }
  });
});

describe("ModelV2FileSchema", () => {
  const layer = (edges: number[]) => ({
    n_cells: 1000,
    edges,
    sources: { oof: 700, holdout: 250, in_sample: 50 },
    metrics: {},
  });
  const ok = {
    model: "v2",
    grid: { crs: "EPSG:32633", x0: 282549.4208, y0: 5176239.1188, cell: 120, width: 1180, height: 1120 },
    classes: 5,
    layers: {
      bodies: layer([0.01, 0.1, 0.2, 0.3, 0.4, 0.6]),
      diffuse: layer([0.02, 0.05, 0.08, 0.2, 0.35, 0.59]),
    },
  };

  it("accepts the pipeline output with empty metrics", () => {
    expect(() => parseOrThrow(ModelV2FileSchema, ok, "model_v2")).not.toThrow();
  });

  it("accepts owner-provided numeric metrics", () => {
    const withMetrics = {
      ...ok,
      layers: { ...ok.layers, bodies: { ...ok.layers.bodies, metrics: { "AUC holdout": 0.81 } } },
    };
    expect(() => parseOrThrow(ModelV2FileSchema, withMetrics, "model_v2")).not.toThrow();
  });

  it("rejects a payload without one of the two layers", () => {
    const onlyBodies = { ...ok, layers: { bodies: ok.layers.bodies } };
    expect(() => parseOrThrow(ModelV2FileSchema, onlyBodies, "model_v2")).toThrow(/diffuse/);
  });

  it("rejects edges that do not match the class count", () => {
    const bad = { ...ok, layers: { ...ok.layers, bodies: layer([0, 0.5, 1]) } };
    expect(() => parseOrThrow(ModelV2FileSchema, bad, "model_v2")).toThrow(/edges/);
  });

  it("rejects decreasing edges", () => {
    const bad = { ...ok, layers: { ...ok.layers, diffuse: layer([0, 0.3, 0.2, 0.4, 0.5, 0.6]) } };
    expect(() => parseOrThrow(ModelV2FileSchema, bad, "model_v2")).toThrow(/non-decreasing/);
  });

  it("rejects a J-style model file (wrong model id)", () => {
    expect(() =>
      parseOrThrow(ModelV2FileSchema, { ...ok, model: "j3" }, "model_v2"),
    ).toThrow(/model/);
  });
});
