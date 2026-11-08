import { describe, expect, it } from "vitest";
import {
  freshness,
  parseMeasures,
  parseRadar,
  parseUTC,
  sensorGeoJSON,
  windGeoJSON,
} from "./data";
const row = {
  station_id: 212,
  sensor_id: 6,
  station_name: "Trieste",
  lon: 13.75,
  lat: 45.65,
  value: 3.8,
  dt: "2026-11-08 15:30:00",
};
describe("PCR observations", () => {
  it("interprets timezone-free source times as UTC and rejects calendar rollover", () => {
    expect(parseUTC(row.dt)).toBe(Date.UTC(2026, 10, 8, 15, 30));
    expect(parseUTC("2026-02-30 12:00:00")).toBeNaN();
    expect(parseUTC("2026-11-08 15:30:00+0200")).toBeNaN();
  });
  it("keeps the newest observation per sensor for the map but all observations in a series", () => {
    const input = {
      result: "OK",
      measures: [row, { ...row, value: 4, dt: "2026-11-08 15:45:00" }, row],
    };
    expect(parseMeasures(input)).toHaveLength(1);
    expect(parseMeasures(input)[0]?.value).toBe(4);
    expect(parseMeasures(input, false)).toHaveLength(3);
  });
  it("does not turn missing values into measured zero or accept invalid coordinates", () => {
    const input = {
      measures: [
        { ...row, value: null },
        { ...row, value: "" },
        { ...row, lon: 200 },
        { ...row, value: 0 },
      ],
    };
    expect(parseMeasures(input).map((x) => x.value)).toEqual([0]);
    expect(() => parseMeasures({ result: "ERROR", measures: [row] })).toThrow();
  });
  it("marks stale and future observations instead of presenting them as live", () => {
    const now = parseUTC("2026-11-08 16:00:00");
    expect(freshness(now - 30 * 60000, now)).toBe("recent");
    expect(freshness(now - 60 * 60000, now)).toBe("delayed");
    expect(freshness(now - 180 * 60000, now)).toBe("old");
    expect(freshness(now + 10 * 60000, now)).toBe("invalid");
    expect(
      sensorGeoJSON(
        parseMeasures({ measures: [row] }),
        "wind",
        now + 180 * 60000,
      ).features[0]?.properties?.stale,
    ).toBe(true);
  });
  it("draws wind toward its destination and only pairs directions close in time", () => {
    const m = parseMeasures({
      measures: [row, { ...row, sensor_id: 5, value: 0 }],
    });
    const f = windGeoJSON(m, "wind").features[0]!;
    expect(f.geometry.coordinates[1]![1]).toBeLessThan(
      f.geometry.coordinates[0]![1]!,
    );
    expect(
      windGeoJSON(
        parseMeasures({
          measures: [
            row,
            { ...row, sensor_id: 5, value: 0, dt: "2026-11-08 14:00:00" },
          ],
        }),
        "wind",
      ).features,
    ).toHaveLength(0);
  });
});
describe("wind freshness", () => {
  it("uses the older direction timestamp to classify an arrow and excludes future directions", () => {
    const now = parseUTC("2026-11-08 16:00:00");
    const all = parseMeasures({
      measures: [
        row,
        { ...row, sensor_id: 5, value: 90, dt: "2026-11-08 15:10:00" },
      ],
    });
    expect(windGeoJSON(all, "wind", now).features[0]?.properties?.stale).toBe(
      true,
    );
    const future = parseMeasures({
      measures: [
        { ...row, dt: "2026-11-08 16:00:00" },
        { ...row, sensor_id: 5, value: 90, dt: "2026-11-08 16:10:00" },
      ],
    });
    expect(windGeoJSON(future, "wind", now).features).toHaveLength(0);
  });
});
describe("PCR image georeferencing", () => {
  it("converts xmin/ymax/xmax/ymin to MapLibre corners without swapping axes", () => {
    const f = parseRadar({
      id: 123,
      dt: row.dt,
      name: "SRI",
      format: "image/png",
      details: { extent: [12, 47, 15, 44] },
    });
    expect(f.coordinates).toEqual([
      [12, 47],
      [15, 47],
      [15, 44],
      [12, 44],
    ]);
    expect(() =>
      parseRadar({
        id: 123,
        dt: row.dt,
        name: "SRI",
        format: "image/png",
        details: { extent: [15, 47, 12, 44] },
      }),
    ).toThrow();
  });
});
