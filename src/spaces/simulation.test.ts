import { describe, it, expect } from "vitest";
import { EXPERIENCES } from "./experiences";
import {
  dailyEntries,
  demand,
  localDayStart,
  localTime,
  NORMAL,
  presence,
  reading,
  simulatedEvents,
  virtualTrips,
  zonePeople,
} from "./simulation";
const at = Date.parse("2026-11-09T12:00:00Z"),
  retail = EXPERIENCES.find((s) => s.id === "retail")!,
  traffic = EXPERIENCES.find((s) => s.id === "traffic")!,
  mountain = EXPERIENCES.find((s) => s.id === "mountain")!;
describe("continuous reproducible demo model", () => {
  it("balances zone presence and bounds the parking capacity", () => {
    for (const hour of [0, 8, 12, 17, 21])
      for (const id of ["normal", "peak", "rain"] as const) {
        const t = Date.parse(
            `2026-11-09T${String(hour).padStart(2, "0")}:00:00Z`,
          ),
          s = { id, since: t - 3600000 };
        const total = presence(retail, t, s),
          zones = zonePeople(retail, t, s);
        expect(Object.values(zones).reduce((a, b) => a + b, 0)).toBe(total);
        for (const z of retail.zones)
          if (zones[z.id] !== undefined)
            expect(zones[z.id]).toBeLessThanOrEqual(z.capacity!);
        const park = retail.sensors.find((a) => a.metric === "parking")!,
          p = reading(retail, park, t, s).value;
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThanOrEqual(park.capacity!);
      }
  });
  it("has real night periods instead of perpetual shopping activity", () => {
    const night = Date.parse("2026-11-09T02:00:00Z");
    expect(demand(retail, night)).toBe(0);
    expect(presence(retail, night)).toBe(0);
    expect(dailyEntries(retail, night)).toBe(0);
  });
  it("integrates daily passages monotonically and changes no past data before a scenario begins", () => {
    expect(dailyEntries(retail, at + 3600000)).toBeGreaterThan(
      dailyEntries(retail, at),
    );
    const s = { id: "peak" as const, since: at };
    expect(demand(retail, at - 60000, s)).toBe(
      demand(retail, at - 60000, NORMAL),
    );
    expect(demand(retail, at + 1800000, s)).toBeGreaterThan(
      demand(retail, at + 1800000, NORMAL),
    );
  });
  it("keeps past event identities when the visible window advances", () => {
    const a = simulatedEvents(traffic, at - 2 * 3600000),
      b = simulatedEvents(traffic, at),
      common = a.filter((e) => b.some((v) => v.id === e.id));
    expect(common.length).toBeGreaterThanOrEqual(3);
    for (const e of common) expect(b.find((v) => v.id === e.id)).toEqual(e);
    expect(b.every((e) => e.time <= at)).toBe(true);
  });
  it("moves stable trip symbols smoothly without multiplying epoch time by changing speeds", () => {
    const a = virtualTrips(traffic, 0, at),
      b = virtualTrips(traffic, 0, at + 1000),
      common = a.filter((x) => b.some((v) => v.id === x.id));
    expect(common.length).toBeGreaterThan(0);
    for (const x of common) {
      const y = b.find((v) => v.id === x.id)!,
        dx =
          (x.coordinates[0] - y.coordinates[0]) *
          111320 *
          Math.cos((x.coordinates[1] * Math.PI) / 180),
        dy = (x.coordinates[1] - y.coordinates[1]) * 110574;
      expect(Math.hypot(dx, dy)).toBeLessThan(15);
    }
  });
  it("actually redistributes the mountain demand in the efficient scenario", () => {
    const t = Date.parse("2026-11-09T10:00:00Z");
    expect(
      demand(mountain, t, { id: "efficient", since: t - 3600000 }),
    ).not.toBe(demand(mountain, t));
  });
  it("reconstructs values from an absolute time and handles the 25-hour Rome day", () => {
    const t = Date.parse("2026-10-25T12:00:00Z");
    expect(localTime(localDayStart(t)).hour).toBe(0);
    expect(new Date(localDayStart(t)).toISOString()).toBe(
      "2026-10-24T22:00:00.000Z",
    );
    const sensor = retail.sensors[0]!;
    expect(reading(retail, sensor, at)).toEqual(reading(retail, sensor, at));
  });
});
