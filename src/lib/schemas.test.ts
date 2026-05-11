import { describe, expect, it } from "vitest";
import {
  CellGridFileSchema,
  ComuneFeatureCollectionSchema,
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
      parseOrThrow(CellGridFileSchema, { step: 0.002, data: [1, "two" as unknown as number, 3] }, "cell_grid"),
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

  it("rejects a feature with wrong type", () => {
    const fc = {
      type: "FeatureCollection",
      features: [{ type: "NotAFeature", geometry: {}, properties: {} }],
    };
    expect(() => parseOrThrow(ComuneFeatureCollectionSchema, fc, "comuni")).toThrow();
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
    const first = parsed.features[0];
    if (!first) throw new Error("expected feature");
    expect((first.properties as { custom_field?: number }).custom_field).toBe(42);
  });
});
