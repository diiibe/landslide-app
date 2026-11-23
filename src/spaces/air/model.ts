import { rampColor } from "@/map/hoverCard";
import inside from "@turf/boolean-point-in-polygon";
import type {
  AiaCategory,
  AiaFeature,
  AirData,
  AirLayer,
  AirQuestion,
  Measure,
  Municipality,
  Pollutant,
  Sector,
  Station,
} from "./types";
export const AIR_BASE = `${import.meta.env.BASE_URL}data/spaces/air/`;
export const LAYER_NAMES: Record<AirLayer, string> = {
  corine: "Copertura CORINE 2018",
  observations: "Centraline ambientali",
  stack: "Camino di Fanna",
  inventory: "Emissioni comunali",
  world: "Copertura del suolo",
  industrial: "Zone industriali e artigianali",
  commercial: "Zone commerciali",
  aia: "Attività autorizzate AIA",
};
export const QUESTIONS: Record<
  AirQuestion,
  { title: string; detail: string; layers: AirLayer[] }
> = {
  observations: {
    title: "Che aria misurano le centraline?",
    detail: "Misure dell’aria insieme al contesto del territorio",
    layers: ["observations", "world", "industrial", "commercial"],
  },
  inventory: {
    title: "Dove e quanto si emette?",
    detail: "Stime annuali insieme a suolo e destinazioni dei piani",
    layers: ["inventory", "world", "industrial", "commercial"],
  },
  landcover: {
    title: "Che territorio c’è intorno?",
    detail:
      "Leggi suolo, zone produttive e commerciali insieme agli altri dati",
    layers: ["world", "industrial", "commercial"],
  },
};
export const SECTOR_NAMES: Record<Sector, string> = {
  industry: "Industria",
  nonindustrial: "Combustione non industriale",
  road: "Trasporto su strada",
  all: "Tutti i macrosettori",
};
export const MEASURE_NAMES: Record<Measure, string> = {
  pm10: "PM10",
  pm25: "PM2.5",
  no2: "NO₂",
};
export const SECTORS: Record<Sector, number[] | null> = {
  industry: [3, 4],
  nonindustrial: [2],
  road: [7],
  all: null,
};
export const PALETTE = ["#f5ecd2", "#d6b375", "#b67539", "#8d461c", "#4a2413"];
export const STATION_COLORS = [
  "#dce6cc",
  "#d6b375",
  "#b67539",
  "#8d461c",
  "#5f2a25",
];
export const AIA_COLORS: Record<Exclude<AiaCategory, "all">, string> = {
  industry: "#75518f",
  farm: "#527d3e",
  waste: "#b17630",
  other: "#517a85",
};
export const CATEGORY_NAMES: Record<AiaCategory, string> = {
  all: "Tutte",
  industry: "Industria",
  farm: "Allevamenti",
  waste: "Rifiuti",
  other: "Altre attività",
};
export const fmt = (n: number | null | undefined, d = 2) =>
  n == null || !Number.isFinite(n)
    ? "—"
    : new Intl.NumberFormat("it-IT", {
        maximumFractionDigits: d,
        ...(n !== 0 && Math.abs(n) < 0.01
          ? { maximumSignificantDigits: 3 }
          : {}),
      }).format(n);
export const day = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Rome",
  });
export const normal = (s: string) =>
  s
    .split("/")[0]!
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("it");
export const aggregate = (m: Municipality, p: Pollutant, s: Sector) => {
  const rows = m.properties.sectors.filter(
      (r) => !SECTORS[s] || SECTORS[s]!.includes(r.code),
    ),
    valid = rows.filter(
      (r) => r.values[p] !== null && Number.isFinite(r.values[p]),
    );
  return {
    value: valid.length
      ? valid.reduce((sum, r) => sum + r.values[p]!, 0)
      : null,
    known: valid.length,
    blank: rows.length - valid.length,
  };
};
export const read = (
  station: Station | undefined,
  measure: Measure,
  date: string,
) => station?.series[measure]?.find((r) => r.date === date)?.value ?? null;
export const observationDates = (data: AirData) =>
  [
    ...new Set(
      data.stations.flatMap((s) =>
        Object.values(s.series).flatMap((rows) =>
          (rows ?? []).map((r) => r.date),
        ),
      ),
    ),
  ].sort();
export const stationDomain = (data: AirData, m: Measure) =>
  Math.max(
    1,
    ...data.stations.flatMap((s) =>
      (s.series[m] ?? []).map((r) => r.value ?? 0),
    ),
  );
export const stationTone = (value: number | null, max: number) =>
  value === null
    ? "#8e9990"
    : rampColor(
        STATION_COLORS.map((c, i) => [(max * i) / 4, c] as const),
        value,
      );
export const inventoryDomain = (data: AirData, p: Pollutant) =>
  Math.max(
    1,
    ...data.municipalities.features.map(
      (m) => aggregate(m, p, "all").value ?? 0,
    ),
  );
export const paired = (
  a: Station | undefined,
  b: Station | undefined,
  m: Measure,
  dates: string[],
  end: string,
) =>
  dates
    .filter((d) => d <= end)
    .flatMap((date) => {
      const x = read(a, m, date),
        y = read(b, m, date);
      return x !== null && y !== null ? [{ date, a: x, b: y }] : [];
    });
export function aiaGroups(f: AiaFeature): Exclude<AiaCategory, "all">[] {
  const codes = [...f.properties.activity.matchAll(/\b(\d+)\.(\d+)/g)].map(
      (m) => [Number(m[1]), Number(m[2])],
    ),
    groups: Exclude<AiaCategory, "all">[] = [];
  if (
    codes.some(
      ([a, b]) =>
        [2, 3, 4].includes(a!) ||
        (a === 6 && [1, 2, 3, 4, 5, 7, 9, 10].includes(b!)),
    )
  )
    groups.push("industry");
  if (codes.some(([a, b]) => a === 6 && b === 6)) groups.push("farm");
  if (codes.some(([a]) => a === 5)) groups.push("waste");
  return groups.length ? groups : ["other"];
}
export function filteredAia(
  data: AirData,
  category: AiaCategory,
  query: string,
  municipality: string | null,
) {
  const q = normal(query);
  return data.aia.features.filter(
    (f) =>
      (category === "all" || aiaGroups(f).includes(category)) &&
      (!municipality || f.properties.municipality === municipality) &&
      (!q ||
        normal(
          [
            f.properties.name,
            f.properties.municipality,
            f.properties.activity,
          ].join(" "),
        ).includes(q)),
  );
}
export function distance(a: number[], b: number[]) {
  const r = Math.PI / 180,
    dlat = (b[1]! - a[1]!) * r,
    dlon = (b[0]! - a[0]!) * r,
    h =
      Math.sin(dlat / 2) ** 2 +
      Math.cos(a[1]! * r) * Math.cos(b[1]! * r) * Math.sin(dlon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}
export const covers = (
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon,
  point: number[],
) => inside(point, geometry);
export const STACK_SITE: [number, number] = [12.74110697, 46.17673013];

export const stackSite = (data: AirData): [number, number] => {
  const record = data.aia.features.find((f) =>
    /FANNA.*CEMENTI|CEMENT.*FANNA/i.test(f.properties.name),
  );
  return record
    ? (record.geometry.coordinates.slice(0, 2) as [number, number])
    : STACK_SITE;
};
