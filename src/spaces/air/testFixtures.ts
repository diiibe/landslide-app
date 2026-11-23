import type { AirContext, AirData, WorldCover } from "./types";
export const airFixture = (): AirData => ({
  snapshot: "2026-11-01",
  retrievedAt: "2026-11-01T12:00:00Z",
  sourceStatus: {},
  sources: [],
  stations: [
    {
      id: "A",
      name: "Sito A",
      coordinates: [12.65, 45.95],
      series: {
        pm10: [{ date: "2026-11-01", value: 20, raw: "20", valid: true }],
      },
    },
    {
      id: "B",
      name: "Sito B",
      coordinates: [12.66, 45.96],
      series: {
        pm10: [{ date: "2026-11-01", value: 30, raw: "30", valid: true }],
      },
    },
  ],
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
              name: "Combustione",
              values: { NOx: 10, PM10: 2, PM2_5: null },
            },
          ],
        },
      },
    ],
  },
  aia: {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [12.7, 45.96] },
        properties: {
          id: "PN1",
          name: "Attività test",
          municipality: "PORDENONE",
          activity: "3.1 e 5.2",
          state: "AUTORIZZATA",
          code: "PN/AIA/1",
          sourceUrl: "https://www.regione.fvg.it/",
        },
      },
    ],
  },
  sme: [
    {
      date: "2026-11-01",
      NOx: 449.6,
      dust: 4.8,
      SO2: 52.9,
      unit: "mg/Nm³",
      source: "SME",
    },
  ],
});
export const contextFixture: AirContext = {
  snapshot: "2026-11-01",
  sources: [],
  industrialZones: { type: "FeatureCollection", features: [] },
  commercialZones: { type: "FeatureCollection", features: [] },
};
export const worldFixture: WorldCover = {
  title: "WorldCover",
  referenceYear: 2021,
  tileSize: 512,
  minzoom: 7,
  maxzoom: 12,
  bounds: [12, 45, 13, 47],
  classes: [{ code: 50, name: "Edificato", color: "#b96559" }],
  credit: "ESA",
  url: "https://esa-worldcover.org",
  license: "CC BY 4.0",
  sourceSha256: "test",
};
