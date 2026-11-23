import { beforeEach, expect, it, vi } from "vitest";
import { aggregate, paired, read } from "./model";
import {
  mergeAirObservations,
  parseObservation,
  preserveNewerSeries,
} from "./observations";
import {
  adoptAirData,
  setAirLayer,
  setAirOpacity,
  toggleAirQuestion,
  useAirStore,
} from "./store";
import type { AirData, Station } from "./types";
const station = (id: string): Station => ({
  id,
  name: id,
  coordinates: [12.6, 45.95],
  series: { pm10: [{ date: "2026-11-01", value: 20, raw: "20", valid: true }] },
});
const data: AirData = {
  snapshot: "2026-11-01",
  retrievedAt: "2026-11-01T12:00:00Z",
  stations: [station("A"), station("B")],
  municipalities: {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [12, 45],
              [13, 45],
              [13, 46],
              [12, 45],
            ],
          ],
        },
        properties: {
          istat: "93033",
          name: "Pordenone",
          center: [12.65, 45.95],
          sectors: [
            {
              code: 3,
              name: "Industria",
              values: { NOx: null, PM10: 0.0006, PM2_5: 0 },
            },
            {
              code: 4,
              name: "Processi",
              values: { NOx: null, PM10: null, PM2_5: 0 },
            },
          ],
        },
      },
    ],
  },
  aia: { type: "FeatureCollection", features: [] },
  sme: [],
  sources: [],
  sourceStatus: {},
};
beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  useAirStore.setState({
    ...useAirStore.getInitialState(),
    layers: Object.fromEntries(
      Object.keys(useAirStore.getInitialState().layers).map((k) => [k, false]),
    ) as ReturnType<typeof useAirStore.getState>["layers"],
  });
});
it("reconciles empty question groups without resurrecting shared or manual layers", () => {
  toggleAirQuestion("observations");
  toggleAirQuestion("inventory");
  setAirLayer("observations", false);
  setAirLayer("world", false);
  setAirLayer("industrial", false);
  setAirLayer("commercial", false);
  expect(useAirStore.getState().questions).toEqual(["inventory"]);
  setAirLayer("inventory", false);
  expect(useAirStore.getState().questions).toEqual([]);
  expect(useAirStore.getState().controls).toBeNull();
  expect(Object.values(useAirStore.getState().layers).some(Boolean)).toBe(
    false,
  );
  toggleAirQuestion("observations");
  expect(useAirStore.getState().questions).toEqual(["observations"]);
});
it("preserves manually enabled layers and shared context on a question toggle", () => {
  setAirLayer("aia", true);
  toggleAirQuestion("observations");
  toggleAirQuestion("inventory");
  toggleAirQuestion("observations");
  expect(useAirStore.getState().layers).toMatchObject({
    observations: false,
    inventory: true,
    world: true,
    aia: true,
  });
  toggleAirQuestion("inventory");
  expect(useAirStore.getState().layers).toMatchObject({
    inventory: false,
    world: false,
    aia: true,
  });
});
it("retires zero-opacity questions and can restart and stop them cleanly", () => {
  toggleAirQuestion("landcover");
  for (const k of ["world", "industrial", "commercial"] as const)
    setAirOpacity(k, 0);
  expect(useAirStore.getState().questions).toEqual([]);
  toggleAirQuestion("landcover");
  toggleAirQuestion("landcover");
  expect(useAirStore.getState().layers.world).toBe(false);
});
it("keeps blanks distinct from zero in emissions and pairs only common valid days", () => {
  expect(
    aggregate(data.municipalities.features[0]!, "NOx", "industry").value,
  ).toBeNull();
  expect(
    aggregate(data.municipalities.features[0]!, "PM10", "industry").value,
  ).toBe(0.0006);
  expect(
    aggregate(data.municipalities.features[0]!, "PM2_5", "industry").value,
  ).toBe(0);
  expect(
    paired(
      station("A"),
      { ...station("B"), series: {} },
      "pm10",
      ["2026-11-01"],
      "2026-11-01",
    ),
  ).toEqual([]);
});
it("invalidates insufficient observations and preserves raw qualifiers", () => {
  const row = parseObservation(
    {
      data_misura: "2026-11-01T00:00:00",
      media_giornaliera: "20",
      dati_insuff: "True",
    },
    "media_giornaliera",
  );
  expect(row).toMatchObject({
    value: null,
    valid: false,
    raw: "20",
    insufficient: true,
  });
  expect(
    parseObservation(
      {
        data_misura: "2026-11-01",
        media_giornaliera: "0",
        dati_insuff: "False",
      },
      "media_giornaliera",
    )?.value,
  ).toBe(0);
});
it("adopts revisions without changing station identity or accepting conflicting duplicates", () => {
  const rows = [
    {
      ubicazione: "A",
      data_misura: "2026-11-01",
      media_giornaliera: "21",
      unita_misura: "ug/m3",
      dati_insuff: "False",
    },
  ];
  const result = mergeAirObservations([station("A")], "pm10", rows);
  expect(result[0]?.id).toBe("A");
  expect(read(result[0], "pm10", "2026-11-01")).toBe(21);
  expect(station("A").series.pm10?.[0]?.value).toBe(20);
  expect(() =>
    mergeAirObservations([station("A")], "pm10", [
      ...rows,
      { ...rows[0]!, media_giornaliera: "22" },
    ]),
  ).toThrow();
});
it("does not roll back a newer direct series to an older publication", () => {
  const current = {
    ...data,
    stations: [
      {
        ...station("A"),
        series: {
          pm10: [{ date: "2026-11-01", value: 23, valid: true, raw: "23" }],
        },
      },
    ],
    sourceStatus: {
      pm10: {
        checkedAt: "2026-11-02T12:00:00Z",
        retrievedAt: "2026-11-02T12:00:00Z",
        error: null,
        cadence: "daily",
      },
    },
  };
  const merged = preserveNewerSeries(data, current);
  expect(read(merged.stations[0], "pm10", "2026-11-01")).toBe(23);
});
it("follows new published dates only when the user has not pinned the day", () => {
  adoptAirData(data);
  expect(useAirStore.getState().date).toBe("2026-11-01");
  useAirStore.setState({ date: "2026-10-30", followLatest: false });
  adoptAirData(data);
  expect(useAirStore.getState().date).toBe("2026-10-30");
});

it("restores the historical cover preference after a question and targets the last temporal layer", () => {
  setAirLayer("corine", true);
  toggleAirQuestion("observations");
  expect(useAirStore.getState().layers).toMatchObject({
    world: true,
    corine: false,
  });
  toggleAirQuestion("observations");
  expect(useAirStore.getState().layers).toMatchObject({
    world: false,
    corine: true,
  });
  setAirLayer("stack", true);
  expect(useAirStore.getState().timeTarget).toBe("stack");
  setAirLayer("observations", true);
  expect(useAirStore.getState().timeTarget).toBe("observations");
  expect(
    parseObservation(
      { data_misura: "2026-02-30", media_giornaliera: 3 },
      "media_giornaliera",
    ),
  ).toBeNull();
});
