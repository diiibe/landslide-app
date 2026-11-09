import { describe, it, expect } from "vitest";
import { analyse, decodeGrid, analyseNetwork, type Grid } from "./core";
import { utm33, intersectionArea, lineIntervals } from "./geometry";
import fixtures from "./fixtures.json";
const grid: Grid = {
  width: 2,
  height: 2,
  x0: 350000,
  y0: 5150000,
  cell: 120,
  classes: [new Uint8Array([1, 5, 0, 3]), new Uint8Array([2, 4, 0, 5])],
  scores: [
    new Float32Array([0.2, 0.8, NaN, 0.5]),
    new Float32Array([0.1, 0.7, NaN, 0.6]),
  ],
};
const polygon = (ring: number[][], hole?: number[][]): GeoJSON.Polygon => ({
  type: "Polygon",
  coordinates: hole ? [ring, hole] : [ring],
});
describe("complete area analysis", () => {
  it("matches independent pyproj UTM33 fixtures to a millimetre", () => {
    for (const [p, xy] of [
      [
        [13, 46.35],
        [346116.1576061294, 5134879.824915954],
      ],
      [
        [13.215, 46.13],
        [362108.2196856624, 5110040.28226972],
      ],
      [
        [13.29, 45.99],
        [367567.5432825615, 5094357.975710679],
      ],
    ]) {
      const q = utm33(p!);
      expect(q[0]).toBeCloseTo(xy![0]!, 3);
      expect(q[1]).toBeCloseTo(xy![1]!, 3);
    }
  });
  it("weights partial cells by actual intersection area, including holes", () => {
    const r = analyse(polygon(fixtures.half, fixtures.hole), grid);
    expect(r.areaM2).toBeCloseTo(18000, 0);
    expect(r.layers.bodies.classes[0]).toBeCloseTo(10800, 0);
    expect(r.layers.bodies.classes[4]).toBeCloseTo(7200, 0);
    expect(r.layers.bodies.mean).toBeCloseTo(0.44, 5);
    expect(r.layers.bodies.median).toBeCloseTo(0.2, 5);
    expect(r.layers.bodies.p90).toBeCloseTo(0.8, 5);
    expect(r.layers.diffuse.mean).toBeCloseTo(0.34, 5);
  });
  it("keeps unmapped surface out of the classified denominator", () => {
    const r = analyse(polygon(fixtures.outside), grid);
    expect(r.areaM2).toBeCloseTo(28800, 0);
    expect(r.layers.bodies.coveredM2).toBeCloseTo(21600, 0);
    expect(r.layers.bodies.coveredM2 / r.areaM2).toBeCloseTo(0.75, 5);
  });
  it("returns null statistics for a zone outside the model", () => {
    const g = {
      ...grid,
      classes: [new Uint8Array(4), new Uint8Array(4)] as [
        Uint8Array,
        Uint8Array,
      ],
    };
    const r = analyse(polygon(fixtures.half), g);
    expect(r.layers.bodies.mean).toBeNull();
    expect(r.layers.bodies.cells).toBe(0);
  });
  it("clips a concave polygon and excludes holes from line exposure", () => {
    expect(
      intersectionArea(
        [
          [
            [0, 0],
            [3, 0],
            [3, 1],
            [1, 1],
            [1, 3],
            [0, 3],
          ],
        ],
        [0, 0, 3, 3],
      ),
    ).toBe(5);
    expect(
      lineIntervals(
        [-1, 1],
        [5, 1],
        [
          [
            [0, 0],
            [4, 0],
            [4, 2],
            [0, 2],
          ],
          [
            [1, 0.5],
            [3, 0.5],
            [3, 1.5],
            [1, 1.5],
          ],
        ],
      ),
    ).toEqual([
      [1 / 6, 2 / 6],
      [4 / 6, 5 / 6],
    ]);
  });
  it("rejects holes outside the exterior and repeated contour paths", () => {
    expect(() =>
      analyse(
        polygon(
          fixtures.half,
          fixtures.hole.map(([x, y]) => [x! + 0.01, y!]),
        ),
        grid,
      ),
    ).toThrow(/foro/);
    const ring = [...fixtures.half.slice(0, -1), ...fixtures.half];
    expect(() => analyse(polygon(ring), grid)).toThrow(/ripassa/);
  });
  it("rejects corrupt analytical data before reading typed arrays", () => {
    expect(() => decodeGrid(new ArrayBuffer(40))).toThrow();
  });
  it("clips full network segments to the polygon rather than counting their whole length", () => {
    const b = new ArrayBuffer(48),
      d = new DataView(b);
    new Uint8Array(b).set(new TextEncoder().encode("FVNET1"));
    d.setUint32(8, 1, true);
    d.setFloat64(12, 350000, true);
    d.setFloat64(20, 5150000, true);
    d.setUint32(28, 16, true);
    new Int32Array(b, 32).set([-6000, -6000, 24000, -6000]);
    const r = analyseNetwork(b, polygon(fixtures.half), grid);
    expect(r.totalKm).toBeCloseTo(0.18, 5);
    expect(r.segments).toBe(1);
    expect(r.bodiesKm.reduce((s, v) => s + v, 0)).toBeCloseTo(0.18, 8);
  });
});
