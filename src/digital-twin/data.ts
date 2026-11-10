/** PCR timestamps are UTC even though the API omits the timezone suffix. */
export const PCR_API = "https://monitor.protezionecivile.fvg.it/api";
export const TWIN_DATA = `${import.meta.env.BASE_URL}data/twin/`;
export const VARIABLE_GROUPS = { weather: "Meteo", water: "Acqua e costa", land: "Suolo e verde" } as const;
export const VARIABLES = {
  wind: {
    id: 6,
    label: "Vento",
    shortLabel: "Vento",
    group: "weather",
    description: "Velocità del vento alla stazione. Le frecce usano la direzione misurata, non una simulazione.",
    comparable: true,
    unit: "m/s",
    min: 0,
    max: 25,
    colors: ["#a3cbc6", "#5ebfcc", "#b17bba"],
  },
  gust: {
    id: 7,
    label: "Raffiche di vento",
    shortLabel: "Raffiche",
    group: "weather",
    description: "Velocità massima riportata dalla stazione, distinta dal vento medio.",
    comparable: true,
    unit: "m/s",
    min: 0,
    max: 35,
    colors: ["#a3cbc6", "#5ebfcc", "#b17bba"],
  },
  temperature: {
    id: 2,
    label: "Temperatura aria",
    shortLabel: "Temperatura",
    group: "weather",
    description: "Temperatura dell’aria nel punto di misura. Non è una temperatura stimata per ogni edificio.",
    comparable: true,
    unit: "°C",
    min: -10,
    max: 35,
    colors: ["#7e94b0", "#a4c8ad", "#e0b361"],
  },
  humidity: {
    id: 3,
    label: "Umidità aria",
    shortLabel: "Umidità aria",
    group: "weather",
    description: "Umidità relativa dell’aria presso la stazione.",
    comparable: true,
    unit: "%",
    min: 0,
    max: 100,
    colors: ["#c1d6c8", "#5ebfcc", "#7e94b0"],
  },
  rain5: {
    id: 52,
    label: "Pioggia negli ultimi 5 minuti",
    shortLabel: "Pioggia 5 min",
    group: "weather",
    description: "Accumulo nei 5 minuti precedenti al campione. Non significa che la fonte aggiorni ogni 5 minuti.",
    comparable: true,
    unit: "mm",
    min: 0,
    max: 10,
    colors: ["#c1d6c8", "#5ebfcc", "#b17bba"],
  },
  rainHour: {
    id: 53,
    label: "Pioggia nell’ultima ora",
    shortLabel: "Pioggia 1 h",
    group: "weather",
    description: "Accumulo nei 60 minuti precedenti al campione. Il dato mantiene il proprio orario di osservazione.",
    comparable: true,
    unit: "mm",
    min: 0,
    max: 50,
    colors: ["#c1d6c8", "#5ebfcc", "#b17bba"],
  },
  rain: {
    id: 57,
    label: "Pioggia nelle ultime 24 ore",
    shortLabel: "Pioggia 24 h",
    group: "weather",
    description: "Accumulo nelle 24 ore precedenti al campione, non previsione di pioggia.",
    comparable: true,
    unit: "mm",
    min: 0,
    max: 100,
    colors: ["#c1d6c8", "#5ebfcc", "#b17bba"],
  },
  radiation: {
    id: 18,
    label: "Radiazione globale",
    shortLabel: "Radiazione",
    group: "weather",
    description: "Radiazione solare globale osservata in W/m². Non è produzione elettrica di un impianto.",
    comparable: true,
    unit: "W/m²",
    min: 0,
    max: 1000,
    colors: ["#adc1b2", "#e0b361", "#d26a66"],
  },
  sea: {
    id: 86,
    label: "Livello marino IGM42",
    shortLabel: "Livello mare",
    group: "water",
    description: "Livello del mare nel riferimento IGM42 dichiarato dalla fonte. Non è una quota di allagamento.",
    comparable: true,
    unit: "m",
    min: -1,
    max: 2,
    colors: ["#7e94b0", "#5ebfcc", "#e0b361"],
  },
  hydro: {
    id: 24,
    label: "Livelli idrometrici",
    shortLabel: "Livelli idro",
    group: "water",
    description: "Riferimenti locali: confronta nel tempo la stessa stazione. Gli zeri e le quote non sono omogenei tra i siti; il dato non definisce una soglia di allagamento.",
    comparable: false,
    unit: "m",
    min: 0,
    max: 10,
    colors: ["#7e94b0", "#5ebfcc", "#e0b361"],
  },
  flow: {
    id: 27,
    label: "Portata dei corsi d’acqua",
    shortLabel: "Portata fiumi",
    group: "water",
    description: "Canale PCR Portata_1: volume d’acqua al secondo pubblicato per il punto monitorato.",
    comparable: true,
    unit: "m³/s",
    min: 0,
    max: 500,
    colors: ["#c1d6c8", "#5ebfcc", "#7e94b0"],
  },
  estuaryFlow: {
    id: 41,
    label: "Portata totale alla foce dell’Isonzo",
    shortLabel: "Portata foce",
    group: "water",
    description: "Portata totale della stazione Foce Isonzo. Misura locale, non bilancio dell’intero golfo.",
    comparable: true,
    unit: "m³/s",
    min: -200,
    max: 1000,
    colors: ["#7e94b0", "#5ebfcc", "#e0b361"],
  },
  current: {
    id: 110,
    label: "Corrente media alla foce dell’Isonzo",
    shortLabel: "Corrente media",
    group: "water",
    description: "Velocità media alla stazione Foce Isonzo. Il canale scalare non descrive una direzione spaziale né le correnti dell’intero golfo.",
    comparable: true,
    unit: "m/s",
    min: -1.5,
    max: 1.5,
    colors: ["#7e94b0", "#5ebfcc", "#e0b361"],
  },
  currentUpper: {
    id: 111,
    label: "Corrente superiore alla foce dell’Isonzo",
    shortLabel: "Corrente sup.",
    group: "water",
    description: "Velocità nel livello superiore indicato dalla fonte alla Foce Isonzo. Non è una simulazione del mare.",
    comparable: true,
    unit: "m/s",
    min: -1.5,
    max: 1.5,
    colors: ["#7e94b0", "#5ebfcc", "#e0b361"],
  },
  currentLower: {
    id: 112,
    label: "Corrente inferiore alla foce dell’Isonzo",
    shortLabel: "Corrente inf.",
    group: "water",
    description: "Velocità nel livello inferiore indicato dalla fonte alla Foce Isonzo. Profondità non dedotta dal nome del canale.",
    comparable: true,
    unit: "m/s",
    min: -1.5,
    max: 1.5,
    colors: ["#7e94b0", "#5ebfcc", "#e0b361"],
  },
  waterTemperature: {
    id: 22,
    label: "Temperatura acqua",
    shortLabel: "Temperatura acqua",
    group: "water",
    description: "Canale PCR «Temperatura mare», presente anche presso siti fluviali. Il contesto dipende dalla stazione selezionata.",
    comparable: true,
    unit: "°C",
    min: 0,
    max: 30,
    colors: ["#7e94b0", "#a4c8ad", "#e0b361"],
  },
  soil10: {
    id: 38,
    label: "Umidità suolo a −10 cm",
    shortLabel: "Suolo −10 cm",
    group: "land",
    description: "Contenuto volumetrico d’acqua a 10 cm nel suolo. Misura puntuale, non mappa continua del fabbisogno irriguo.",
    comparable: true,
    unit: "% vol.",
    min: 0,
    max: 60,
    colors: ["#e0b361", "#a4c8ad", "#5ebfcc"],
  },
  soil20: {
    id: 39,
    label: "Umidità suolo a −20 cm",
    shortLabel: "Suolo −20 cm",
    group: "land",
    description: "Contenuto volumetrico d’acqua a 20 cm nel suolo. Confronta le profondità presso lo stesso sito.",
    comparable: true,
    unit: "% vol.",
    min: 0,
    max: 60,
    colors: ["#e0b361", "#a4c8ad", "#5ebfcc"],
  },
  soil40: {
    id: 40,
    label: "Umidità suolo a −40 cm",
    shortLabel: "Suolo −40 cm",
    group: "land",
    description: "Contenuto volumetrico d’acqua a 40 cm nel suolo. Copertura limitata alle stazioni disponibili.",
    comparable: true,
    unit: "% vol.",
    min: 0,
    max: 60,
    colors: ["#e0b361", "#a4c8ad", "#5ebfcc"],
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
  const magnitude = Math.abs(value);
  return value.toLocaleString("it-IT", magnitude > 0 && magnitude < 1e-8
    ? { notation: "scientific", maximumFractionDigits: 2 }
    : magnitude > 0 && magnitude < 1
      ? { maximumSignificantDigits: 3 }
      : { maximumFractionDigits: 2 });
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
/** A display scale, never a hazard threshold or a spatial interpolation. */
export function valueScaleFraction(value: number, variable: Variable): number {
  const v = VARIABLES[variable];
  if (!v.comparable || !Number.isFinite(value)) return 0.5;
  return Math.max(0, Math.min(1, (value - v.min) / (v.max - v.min)));
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
        sensorId: m.sensorId,
        variable,
        name: m.name,
        value: m.value,
        scaleFraction: valueScaleFraction(m.value, variable),
        label: `${formatValue(m.value)} ${VARIABLES[variable].unit}`,
        observedAt: formatTime(m.ms),
        freshness: FRESHNESS_LABEL[freshness(m.ms, now)],
        stale: freshness(m.ms, now) !== "recent",
      },
    })),
  };
}
/** Observed wind, anchored at the station. Bearing points toward destination. */
export function windGeoJSON(
  all: Measure[],
  variable: Variable,
  now = Date.now(),
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
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
    features.push({ type: "Feature", id: m.stationId,
      geometry: { type: "Point", coordinates: [m.lon, m.lat] },
      properties: { stationId: m.stationId, bearing: (dir.value + 180) % 360,
        stale: freshness(m.ms, now) !== "recent" || freshness(dir.ms, now) !== "recent" },
    });
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
