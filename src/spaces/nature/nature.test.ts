import { describe, it, expect, afterEach } from "vitest";
import { CAMERAS, captures, effortHours, captureLabel } from "./wildlife";
import { AIR_OBSERVATIONS, FIRE_DAYS } from "./fire";
import { useNatureStore, treeId, type TreeFeature } from "./store";
import { groupTrees, orderPlan } from "./park";
import { useExperienceStore } from "../store";
import { natureNodes } from "./map";
const now = Date.parse("2026-11-10T12:31:24Z");
afterEach(() => {
  useExperienceStore.setState({ activeId: null, selectedId: null });
  useNatureStore.setState({
    fireDay: 0,
    showAir: true,
    trees: [],
    treeQuery: "",
    family: "all",
    plan: [],
  });
});
describe("wildlife absolute time and effort", () => {
  it("preserves past captures, their scores and identities when the window moves", () => {
    const before = captures(now, 24),
      after = captures(now + 2 * 3600000, 24),
      map = new Map(after.map((c) => [c.id, c]));
    const overlap = before.filter((c) => c.time >= now - 22 * 3600000);
    expect(overlap.length).toBeGreaterThan(10);
    overlap.forEach((c) => expect(map.get(c.id)).toEqual(c));
    expect(new Set(before.map((c) => c.id)).size).toBe(before.length);
    before.forEach((c) => {
      expect(c.time).toBeLessThanOrEqual(now);
      expect(c.time).toBeGreaterThanOrEqual(now - 24 * 3600000);
    });
  });
  it("uses only partial operating hours and conserves possible camera effort", () => {
    for (const t of [
      now,
      Date.parse("2026-10-25T01:30:00Z"),
      Date.parse("2026-03-29T01:30:00Z"),
    ]) {
      const full = effortHours(t, 24),
        half = effortHours(t, 0.5);
      expect(full).toBeGreaterThan(150);
      expect(full).toBeLessThanOrEqual(24 * CAMERAS.length);
      expect(half).toBeGreaterThanOrEqual(0);
      expect(half).toBeLessThanOrEqual(0.5 * CAMERAS.length);
    }
  });
  it("keeps the generated proposal when a human corrects the record", () => {
    const c = captures(now)[0]!,
      copy = structuredClone(c);
    expect(captureLabel(c, { label: "unknown", at: now })).toBe("unknown");
    expect(c).toEqual(copy);
  });
});
describe("real archive fidelity", () => {
  it("keeps all mapped ERPAC records, original fields and distinct identities", () => {
    const trees: TreeFeature[] = Array.from({ length: 7 }, (_, i) => ({
      type: "Feature",
      id: `tree-${i}`,
      geometry: {
        type: "Point",
        coordinates: [13.01 + i * 0.0001, 45.95 + i * 0.0002],
      },
      properties: {
        prog: i + 1,
        specie: i % 2 ? "Fagus sylvatica" : "Larix decidua",
        familia: i % 2 ? "Fagaceae" : "Pinaceae",
        stt_st: "stabile",
        data_rilievo: "2001-02-01",
      },
    }));
    expect(new Set(trees.map(treeId)).size).toBe(7);
    expect(groupTrees(trees, "specie").reduce((n, r) => n + r.count, 0)).toBe(
      7,
    );
    useNatureStore.setState({ trees });
    useExperienceStore.setState({ activeId: "park" });
    const before = JSON.stringify(trees);
    expect(natureNodes(now).features).toHaveLength(7);
    expect(
      new Set(natureNodes(now).features.map((f) => f.properties?.__featureId))
        .size,
    ).toBe(7);
    expect(JSON.stringify(trees)).toBe(before);
    const ids = trees.slice(0, 7).map(treeId),
      ordered = orderPlan([...ids, "missing"], trees);
    expect([...ordered.ids].sort()).toEqual([...ids].sort());
    expect(ordered.distance).toBeGreaterThan(0);
    expect(ids).toEqual(trees.slice(0, 7).map(treeId));
  });
  it("conserves ARPA ranges and repeated observations at a location", () => {
    const p = AIR_OBSERVATIONS.find(
      (o) => o.site === "pissebus" && o.date === "2026-08-16",
    )!;
    expect([p.low, p.high]).toEqual([416, 442]);
    useExperienceStore.setState({ activeId: "fire" });
    useNatureStore.setState({ fireDay: FIRE_DAYS.indexOf("2026-08-15") });
    const nodes = natureNodes(now);
    expect(nodes.features).toHaveLength(2);
    const a = nodes.features.find((f) => f.properties?.id === "amaro")!;
    expect(a.properties?.label).toContain("08:15");
    expect(a.properties?.label).toContain("11:25");
    expect(a.properties?.label).toContain("274");
    expect(a.properties?.label).toContain("42,5");
  });
});
