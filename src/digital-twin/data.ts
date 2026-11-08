/** PCR timestamps are UTC even though the API omits the timezone suffix. */
export const PCR_API = "https://monitor.protezionecivile.fvg.it/api";
export const TWIN_DATA = `${import.meta.env.BASE_URL}data/twin/`;
export const VARIABLES = {
  wind: {
    id: 6,
    label: "Vento",
    unit: "m/s",
    min: 0,
    max: 25,
    colors: ["#a3cbc6", "#5ebfcc", "#b17bba"],
  },
  temperature: {
    id: 2,
    label: "Temperatura",
    unit: "°C",
    min: -10,
    max: 35,
    colors: ["#7e94b0", "#a4c8ad", "#e0b361"],
  },
  rain: {
    id: 57,
    label: "Pioggia nelle ultime 24 ore",
    unit: "mm",
    min: 0,
    max: 100,
    colors: ["#c1d6c8", "#5ebfcc", "#b17bba"],
  },
  sea: {
    id: 86,
    label: "Livello marino IGM42",
    unit: "m",
    min: -1,
    max: 2,
    colors: ["#7e94b0", "#5ebfcc", "#e0b361"],
  },
  radiation: {
    id: 18,
    label: "Radiazione globale",
    unit: "W/m²",
    min: 0,
    max: 1000,
    colors: ["#adc1b2", "#e0b361", "#d26a66"],
  },
} as const;
export type Variable = keyof typeof VARIABLES;
export interface Measure {
  stationId: number;
  sensorId: number;
  name: string;
  lon: number;
  lat: number;
  value: number;
  time: string;
  ms: number;
}
export interface RadarFrame {
  id: number;
  time: string;
  ms: number;
  url: string;
  coordinates: [
    [number, number],
    [number, number],
    [number, number],
    [number, number],
  ];
}
export type Freshness = "recent" | "delayed" | "old" | "invalid";
export function parseUTC(input: unknown): number {
  if (
    typeof input !== "string" ||
    !/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?$/.test(input)
  )
    return NaN;
  const iso = input.replace(" ", "T").replace(/Z$/, "") + "Z",
    n = Date.parse(iso);
  // Reject calendar rollover (e.g. February 30) instead of silently relabelling it.
  return Number.isFinite(n) &&
    new Date(n).toISOString().slice(0, 19) === iso.slice(0, 19)
    ? n
    : NaN;
}
function number(v: unknown): number | null {
  return v !== null &&
    v !== undefined &&
    v !== "" &&
    typeof v !== "boolean" &&
    Number.isFinite(Number(v))
    ? Number(v)
    : null;
}
export function parseMeasures(input: unknown, latestOnly = true): Measure[] {
  const payload = input as { measures?: unknown; result?: unknown } | null;
  const rows = Array.isArray(input) ? input : payload?.measures;
  if (
    !Array.isArray(rows) ||
    (payload?.result !== undefined && payload.result !== "OK")
  )
    throw new Error("Risposta sensori non valida");
  const latest = new Map<string, Measure>(),
    accepted: Measure[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>,
      value = number(r.value),
      lon = number(r.lon),
      lat = number(r.lat),
      stationId = number(r.station_id),
      sensorId = number(r.sensor_id),
      ms = parseUTC(r.dt);
    if (
      value === null ||
      lon === null ||
      lat === null ||
      stationId === null ||
      sensorId === null ||
      !Number.isInteger(stationId) ||
      !Number.isInteger(sensorId) ||
      Math.abs(lon) > 180 ||
      Math.abs(lat) > 90 ||
      !Number.isFinite(ms)
    )
      continue;
    const m = {
        stationId,
        sensorId,
        name:
          typeof r.station_name === "string"
            ? r.station_name
            : `Stazione ${stationId}`,
        lon,
        lat,
        value,
        time: String(r.dt),
        ms,
      },
      key = `${stationId}:${sensorId}`;
    accepted.push(m);
    if (!latest.has(key) || latest.get(key)!.ms < ms) latest.set(key, m);
  }
  if (!latest.size) throw new Error("Nessuna misura valida ricevuta");
  return latestOnly ? [...latest.values()] : accepted;
}
export function freshness(ms: number, now = Date.now()): Freshness {
  const age = now - ms;
  return !Number.isFinite(ms) || age < -5 * 60000
    ? "invalid"
    : age <= 45 * 60000
      ? "recent"
      : age <= 120 * 60000
        ? "delayed"
        : "old";
}
export const FRESHNESS_LABEL: Record<Freshness, string> = {
  recent: "Recente",
  delayed: "In ritardo",
  old: "Dato precedente",
  invalid: "Ora non valida",
};
export function formatTime(ms: number): string {
  return Number.isFinite(ms)
    ? new Intl.DateTimeFormat("it-IT", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "Europe/Rome",
      }).format(ms) + " · Roma"
    : "Ora non disponibile";
}
export function formatValue(value: number): string {
  return value.toLocaleString("it-IT", { maximumFractionDigits: 2 });
}
export function ageLabel(ms: number, now = Date.now()): string {
  const min = Math.floor((now - ms) / 60000);
  return min < -5
    ? "Ora futura da verificare"
    : min < 1
      ? "Meno di un minuto fa"
      : min < 60
        ? `${min} min fa`
        : min < 1440
          ? `${Math.floor(min / 60)} h ${min % 60} min fa`
          : `${Math.floor(min / 1440)} giorni fa`;
}
export function variableMeasures(
  all: Measure[],
  variable: Variable,
): Measure[] {
  return all.filter((m) => m.sensorId === VARIABLES[variable].id);
}
export function sensorGeoJSON(
  all: Measure[],
  variable: Variable,
  now = Date.now(),
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: variableMeasures(all, variable).map((m) => ({
      type: "Feature",
      id: m.stationId,
      geometry: { type: "Point", coordinates: [m.lon, m.lat] },
      properties: {
        stationId: m.stationId,
        name: m.name,
        value: m.value,
        label: `${formatValue(m.value)} ${VARIABLES[variable].unit}`,
        stale: freshness(m.ms, now) !== "recent",
      },
    })),
  };
}
/** Vectors describe measured wind at stations; they are not a particle simulation. */
export function windGeoJSON(
  all: Measure[],
  variable: Variable,
  now = Date.now(),
): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  const features: GeoJSON.Feature<GeoJSON.LineString>[] = [];
  if (variable !== "wind") return { type: "FeatureCollection", features };
  const dirs = new Map(
    all.filter((m) => m.sensorId === 5).map((m) => [m.stationId, m]),
  );
  for (const m of variableMeasures(all, "wind")) {
    const dir = dirs.get(m.stationId);
    if (
      !dir ||
      freshness(dir.ms, now) === "invalid" ||
      dir.value < 0 ||
      dir.value > 360 ||
      Math.abs(dir.ms - m.ms) > 20 * 60000 ||
      m.value <= 0
    )
      continue;
    const a = ((dir.value + 180) * Math.PI) / 180,
      dx = (Math.sin(a) * 0.009) / Math.cos((m.lat * Math.PI) / 180),
      dy = Math.cos(a) * 0.009,
      tip: [number, number] = [m.lon + dx, m.lat + dy];
    const line = (coordinates: number[][]) =>
      features.push({
        type: "Feature",
        geometry: { type: "LineString", coordinates },
        properties: {
          stale:
            freshness(m.ms, now) !== "recent" ||
            freshness(dir.ms, now) !== "recent",
        },
      });
    line([[m.lon, m.lat], tip]);
    line([
      [
        tip[0] -
          (Math.sin(a - 0.5) * 0.003) / Math.cos((m.lat * Math.PI) / 180),
        tip[1] - Math.cos(a - 0.5) * 0.003,
      ],
      tip,
      [
        tip[0] -
          (Math.sin(a + 0.5) * 0.003) / Math.cos((m.lat * Math.PI) / 180),
        tip[1] - Math.cos(a + 0.5) * 0.003,
      ],
    ]);
  }
  return { type: "FeatureCollection", features };
}
export function parseRadar(input: unknown): RadarFrame {
  if (!input || typeof input !== "object")
    throw new Error("Metadati radar non validi");
  const r = input as Record<string, unknown>,
    details = r.details as { extent?: unknown } | undefined,
    e = details?.extent,
    ms = parseUTC(r.dt);
  if (
    r.name !== "SRI" ||
    r.format !== "image/png" ||
    !Array.isArray(e) ||
    e.length !== 4 ||
    !e.every((x) => typeof x === "number" && Number.isFinite(x)) ||
    !Number.isFinite(ms) ||
    !Number.isInteger(r.id)
  )
    throw new Error("Prodotto SRI non georeferenziato");
  const [w, n, east, s] = e as number[];
  if (
    w === undefined ||
    n === undefined ||
    east === undefined ||
    s === undefined ||
    w >= east ||
    s >= n ||
    w < -180 ||
    east > 180 ||
    s < -85 ||
    n > 85
  )
    throw new Error("Estensione radar non valida");
  return {
    id: Number(r.id),
    time: String(r.dt),
    ms,
    url: `${PCR_API}/products/${r.id}`,
    coordinates: [
      [w, n],
      [east, n],
      [east, s],
      [w, s],
    ],
  };
}
export async function getJSON(
  url: string,
  signal: AbortSignal,
): Promise<unknown> {
  const timeout = AbortSignal.timeout(20000),
    response = await fetch(url, {
      signal: AbortSignal.any([signal, timeout]),
      cache: "no-store",
    });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
export function distanceKm(a: [number, number], b: [number, number]): number {
  const rad = Math.PI / 180,
    dlat = (b[1] - a[1]) * rad,
    dlon = (b[0] - a[0]) * rad,
    v =
      Math.sin(dlat / 2) ** 2 +
      Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dlon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(v), Math.sqrt(1 - v));
}
