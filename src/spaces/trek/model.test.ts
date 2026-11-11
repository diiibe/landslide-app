import { describe, expect, it } from "vitest";
import {
  NODES,
  NORMAL,
  latestSlot,
  sampleTime,
  sample,
  samples,
  nodeState,
  windowReport,
  firmwareJSON,
} from "./model";
import network from "./network.json";
const t = Date.parse("2026-11-11T10:00:00Z");
describe("SmartTrek synthetic source", () => {
  it("keeps the same samples across overlapping windows and never invents a future observation", () => {
    for (const node of NODES) {
      const a = samples(node, t - 24 * 3600000, t),
        b = samples(node, t - 6 * 3600000, t);
      expect(a.filter((s) => s.at >= t - 6 * 3600000)).toEqual(b);
      expect(a.every((s) => s.at <= t)).toBe(true);
      expect(nodeState(node, t).sample.cloudAt).toBeLessThanOrEqual(t);
      for (let i = 1; i < a.length; i++)
        expect(a[i]!.at - a[i - 1]!.at).toBeGreaterThanOrEqual(540000);
      for (let i = 1; i < a.length; i++)
        expect(a[i]!.at - a[i - 1]!.at).toBeLessThanOrEqual(660000);
    }
  });
  it("keeps radio receipts separate from DB acknowledgement and conserves every record", () => {
    const scenario = { mode: "uplink" as const, since: t - 20 * 60000 },
      report = windowReport(t, 6, scenario);
    expect(report.waiting).toBeGreaterThan(0);
    expect(report.pending.some((s) => s.masterAt <= t)).toBe(true);
    expect(report.total).toBe(report.confirmed + report.waiting);
    for (const n of NODES) {
      expect(nodeState(n, t, scenario).sample.cloudAt).toBeLessThanOrEqual(t);
    }
    const recovered = windowReport(t + 25 * 60000, 6, scenario);
    expect(recovered.waiting).toBeLessThanOrEqual(1);
    expect(recovered.confirmed).toBeGreaterThan(report.confirmed);
  });
  it("changes only the affected node after the explicit scenario start", () => {
    const scenario = { mode: "supply" as const, since: t - 20 * 60000 };
    for (const n of NODES) {
      const before = latestSlot(n, scenario.since) - 1;
      expect(sample(n, before, scenario)).toEqual(sample(n, before, NORMAL));
      const current = sample(n, latestSlot(n, t), scenario);
      expect(current.railOut).toBe(n.number === 106);
      expect(current.powerMw).toBeCloseTo(
        (current.espMv * current.espMa) / 1000 +
          (current.radioMv * current.radioMa) / 1000,
        0,
      );
    }
  });
  it("uses physical units from the current source example, not deci-mA wire values", () => {
    const node = NODES[1]!,
      s = sample(node, latestSlot(node, t)),
      out = firmwareJSON(node, s);
    expect(out.power.esp32.current_ma).toBe(s.espMa);
    expect(out.demo).toBe(true);
    expect(out.presence.ble_adv_count).toBeGreaterThanOrEqual(
      out.presence.app_checkins,
    );
    expect(out.status.time_synced).toBeTypeOf("boolean");
    expect(JSON.stringify(out)).not.toMatch(
      /temperature|battery|participant|app_token/,
    );
  });
  it("keeps absolute sampling continuous across both Rome DST transitions", () => {
    for (const end of [
      Date.parse("2026-03-29T04:00Z"),
      Date.parse("2026-10-25T04:00Z"),
    ]) {
      const a = samples(NODES[0]!, end - 6 * 3600000, end);
      expect(a.length).toBeGreaterThanOrEqual(35);
      expect(a.length).toBeLessThanOrEqual(37);
      expect(
        a.every((s) => Number.isFinite(s.powerMw) && Number.isInteger(s.ble)),
      ).toBe(true);
      expect(
        sampleTime(NODES[0]!, latestSlot(NODES[0]!, end)),
      ).toBeLessThanOrEqual(end);
    }
  });
  it("places every virtual marker on the actual OSM path with distinct identities", () => {
    const coords = network.route.geometry.coordinates;
    expect(new Set(NODES.map((n) => n.id)).size).toBe(8);
    for (const node of NODES) expect(coords).toContainEqual(node.coordinates);
    expect(network.osmWayIds.length).toBeGreaterThan(0);
  });
});

it("respects the v0.2 BLE admission threshold and keeps an absent peak unavailable", () => {
  for (const n of NODES) {
    for (const s of samples(n, t - 24 * 3600000, t)) {
      if (s.ble > 0) {
        expect(s.peakRssi).toBeGreaterThanOrEqual(-75);
        expect(s.peakRssi).toBeLessThan(0);
      } else expect(s.peakRssi).toBeNull();
      expect(s.hops).toBeLessThanOrEqual(3);
    }
  }
});
