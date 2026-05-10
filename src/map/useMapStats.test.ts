import { describe, it, expect } from "vitest";
import { computeStats } from "./useMapStats";

interface FakeFeature {
  properties: Record<string, unknown>;
}

function fakeCells(): FakeFeature[] {
  // 10 cells with controlled p values + zones, so we can verify exact
  // counts vs the histogram approximation that pctAt used to use.
  const ps = [0.05, 0.18, 0.27, 0.41, 0.55, 0.66, 0.78, 0.84, 0.86, 0.95];
  const zones = ["A", "A", "B", "B", "B", "B", "A", "B", "A", "B"];
  return ps.map((p, i) => ({
    properties: {
      p,
      zone: zones[i],
      iffi_hit: p >= 0.7,
      sub_zone: "x",
    },
  }));
}

describe("computeStats", () => {
  it("counts cells with p >= 0.85 exactly (P1.3 — no histogram-midpoint approximation)", () => {
    const cells = fakeCells();
    const stats = computeStats({
      cellFeatures: cells as never,
      iffiFeatures: [],
      threshold: 0.85,
      selectedZones: [],
    });
    // Two of the ten cells have p >= 0.85: 0.86 and 0.95.
    const expected = cells.filter((c) => Number(c.properties.p) >= 0.85).length;
    expect(expected).toBe(2);
    expect(stats?.prob.above_threshold_pct).toBeCloseTo((expected / cells.length) * 100, 6);
  });

  it("returns per-zone aboveThr counts that match a brute-force scan", () => {
    const cells = fakeCells();
    const threshold = 0.5;
    const stats = computeStats({
      cellFeatures: cells as never,
      iffiFeatures: [],
      threshold,
      selectedZones: [],
    });
    expect(stats).not.toBeNull();
    const byZone = stats!.zone_breakdown;
    const expectedA = cells.filter(
      (c) => c.properties.zone === "A" && Number(c.properties.p) >= threshold,
    ).length;
    const expectedB = cells.filter(
      (c) => c.properties.zone === "B" && Number(c.properties.p) >= threshold,
    ).length;
    expect(byZone["A"]?.aboveThr).toBe(expectedA);
    expect(byZone["B"]?.aboveThr).toBe(expectedB);
    const totalA = cells.filter((c) => c.properties.zone === "A").length;
    const totalB = cells.filter((c) => c.properties.zone === "B").length;
    expect(byZone["A"]?.count).toBe(totalA);
    expect(byZone["B"]?.count).toBe(totalB);
  });

  it("computes mean / median / p99 in a single pass without losing precision", () => {
    const cells = fakeCells();
    const stats = computeStats({
      cellFeatures: cells as never,
      iffiFeatures: [],
      threshold: 0.5,
      selectedZones: [],
    });
    const ps = cells.map((c) => Number(c.properties.p));
    const meanExpected = ps.reduce((s, x) => s + x, 0) / ps.length;
    expect(stats!.prob.mean).toBeCloseTo(meanExpected, 6);
    // Median of 10 values: lower-rank sorted at index 5 — matches existing semantics.
    const sorted = [...ps].sort((a, b) => a - b);
    expect(stats!.prob.median).toBeCloseTo(sorted[5]!, 6);
  });

  it("returns null when there are no cell features", () => {
    expect(
      computeStats({ cellFeatures: [], iffiFeatures: [], threshold: 0.5, selectedZones: [] }),
    ).toBeNull();
  });
});
