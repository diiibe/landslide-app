export const SPECIES = [
  {
    id: "cervo",
    name: "Cervo",
    latin: "Cervus elaphus",
    color: "#d7ac73",
    night: 0.7,
  },
  {
    id: "capriolo",
    name: "Capriolo",
    latin: "Capreolus capreolus",
    color: "#a6c48c",
    night: 0.55,
  },
  {
    id: "cinghiale",
    name: "Cinghiale",
    latin: "Sus scrofa",
    color: "#c29d8c",
    night: 0.85,
  },
  {
    id: "volpe",
    name: "Volpe",
    latin: "Vulpes vulpes",
    color: "#e19b6b",
    night: 0.8,
  },
  {
    id: "tasso",
    name: "Tasso",
    latin: "Meles meles",
    color: "#aeb9c8",
    night: 0.96,
  },
  {
    id: "lepre",
    name: "Lepre",
    latin: "Lepus europaeus",
    color: "#d6c79a",
    night: 0.72,
  },
] as const;
export type SpeciesId = (typeof SPECIES)[number]["id"];
export const CAMERAS: CameraStation[] = [
  {
    id: "cam-1",
    name: "Fototrappola 01",
    coordinates: [13.1883319, 46.4647818],
    target: [13.1883302, 46.4647369],
    bearing: 181,
    heightCm: 50,
    targetDistanceM: 5,
    rangeM: 12,
    fov: 40,
    habitat: "Pista mappata OSM",
    wayId: "211093642",
    installation:
      "Posa virtuale a lato del passaggio, ripresa trasversale. Verificare su terreno pendenza, vegetazione, neve e autorizzazioni.",
  },
  {
    id: "cam-2",
    name: "Fototrappola 02",
    coordinates: [13.1899857, 46.4682088],
    target: [13.1899227, 46.4682204],
    bearing: 285,
    heightCm: 50,
    targetDistanceM: 5,
    rangeM: 12,
    fov: 40,
    habitat: "Pista mappata OSM",
    wayId: "211093645",
    installation:
      "Posa virtuale a lato del passaggio, ripresa trasversale. Verificare su terreno pendenza, vegetazione, neve e autorizzazioni.",
  },
  {
    id: "cam-3",
    name: "Fototrappola 03",
    coordinates: [13.1852343, 46.4683767],
    target: [13.185179, 46.4684004],
    bearing: 302,
    heightCm: 50,
    targetDistanceM: 5,
    rangeM: 12,
    fov: 40,
    habitat: "Sentiero Fassoz",
    wayId: "211093633",
    installation:
      "Posa virtuale a lato del passaggio, ripresa trasversale. Verificare su terreno pendenza, vegetazione, neve e autorizzazioni.",
  },
  {
    id: "cam-4",
    name: "Fototrappola 04",
    coordinates: [13.1797997, 46.468761],
    target: [13.1797353, 46.4687545],
    bearing: 262,
    heightCm: 50,
    targetDistanceM: 5,
    rangeM: 12,
    fov: 40,
    habitat: "Sentiero Fassoz",
    wayId: "926253441",
    installation:
      "Posa virtuale a lato del passaggio, ripresa trasversale. Verificare su terreno pendenza, vegetazione, neve e autorizzazioni.",
  },
  {
    id: "cam-5",
    name: "Fototrappola 05",
    coordinates: [13.1783727, 46.4723277],
    target: [13.1784208, 46.4723581],
    bearing: 48,
    heightCm: 50,
    targetDistanceM: 5,
    rangeM: 12,
    fov: 40,
    habitat: "Sentiero Fassoz",
    wayId: "926253441",
    installation:
      "Posa virtuale a lato del passaggio, ripresa trasversale. Verificare su terreno pendenza, vegetazione, neve e autorizzazioni.",
  },
  {
    id: "cam-6",
    name: "Fototrappola 06",
    coordinates: [13.1765932, 46.4757527],
    target: [13.1765292, 46.4757444],
    bearing: 259,
    heightCm: 50,
    targetDistanceM: 5,
    rangeM: 12,
    fov: 40,
    habitat: "Sentiero Fassoz",
    wayId: "926253441",
    installation:
      "Posa virtuale a lato del passaggio, ripresa trasversale. Verificare su terreno pendenza, vegetazione, neve e autorizzazioni.",
  },
  {
    id: "cam-7",
    name: "Fototrappola 07",
    coordinates: [13.1872811, 46.4765941],
    target: [13.1873411, 46.4765766],
    bearing: 113,
    heightCm: 50,
    targetDistanceM: 5,
    rangeM: 12,
    fov: 40,
    habitat: "Pista mappata OSM",
    wayId: "211093632",
    installation:
      "Posa virtuale a lato del passaggio, ripresa trasversale. Verificare su terreno pendenza, vegetazione, neve e autorizzazioni.",
  },
  {
    id: "cam-8",
    name: "Fototrappola 08",
    coordinates: [13.1793491, 46.4769221],
    target: [13.1792887, 46.4769389],
    bearing: 292,
    heightCm: 50,
    targetDistanceM: 5,
    rangeM: 12,
    fov: 40,
    habitat: "Sentiero Fassoz",
    wayId: "998228373",
    installation:
      "Posa virtuale a lato del passaggio, ripresa trasversale. Verificare su terreno pendenza, vegetazione, neve e autorizzazioni.",
  },
];
export interface CameraStation {
  id: string;
  name: string;
  coordinates: [number, number];
  target: [number, number];
  bearing: number;
  heightCm: number;
  targetDistanceM: number;
  rangeM: number;
  fov: number;
  wayId: string;
  habitat: string;
  installation: string;
}
/** A local viewing sector, not a survey coverage estimate. Metres stay metres at any zoom. */
export function cameraSector(
  camera: CameraStation,
): GeoJSON.Feature<GeoJSON.Polygon> {
  const origin = camera.coordinates,
    ring = [origin];
  for (let i = 0; i <= 16; i++) {
    const angle =
      ((camera.bearing - camera.fov / 2 + (camera.fov * i) / 16) * Math.PI) /
      180;
    ring.push([
      origin[0] +
        (Math.sin(angle) * camera.rangeM) /
          (111320 * Math.cos((origin[1] * Math.PI) / 180)),
      origin[1] + (Math.cos(angle) * camera.rangeM) / 110574,
    ]);
  }
  ring.push(origin);
  return {
    type: "Feature",
    properties: { id: camera.id },
    geometry: { type: "Polygon", coordinates: [ring] },
  };
}
const HOUR = 3600000;
const hourFormatter = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  hourCycle: "h23",
  timeZone: "Europe/Rome",
});
export function hash(value: string) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++)
    h = Math.imul(h ^ value.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}
export function cameraOnline(id: string, time: number) {
  return hash(`${id}:service:${Math.floor(time / HOUR)}`) > 0.065;
}
export interface Capture {
  id: string;
  camera: string;
  time: number;
  species: SpeciesId;
  confidence: number;
  alternative: SpeciesId;
  night: boolean;
  empty: boolean;
}
/** Independent hourly candidates. Absolute IDs survive sliding windows and reloads.
 * This generates labels, not inference over an image and not animal abundance. */
export function captures(now: number, hours = 24): Capture[] {
  const start = now - hours * HOUR,
    out: Capture[] = [];
  for (
    let bucket = Math.floor(start / HOUR);
    bucket <= Math.floor(now / HOUR);
    bucket++
  )
    for (const camera of CAMERAS) {
      const key = `${camera.id}:${bucket}`,
        time = bucket * HOUR + Math.floor(hash(key + ":time") * HOUR);
      if (time < start || time > now || !cameraOnline(camera.id, time))
        continue;
      const hour = Number(hourFormatter.format(time)),
        night = hour < 7 || hour >= 19;
      const index = Math.floor(hash(key + ":species") * SPECIES.length),
        species = SPECIES[index]!;
      if (
        hash(key + ":trigger") >
        (night ? species.night : 0.55 * (1 - species.night))
      )
        continue;
      const confidence =
        Math.round((0.53 + hash(key + ":confidence") * 0.46) * 100) / 100;
      out.push({
        id: key,
        camera: camera.id,
        time,
        species: species.id,
        confidence,
        alternative: SPECIES[(index + 1) % SPECIES.length]!.id,
        night,
        empty: hash(key + ":empty") < 0.09,
      });
    }
  return out.sort((a, b) => b.time - a.time);
}
export function effortHours(now: number, hours = 24) {
  let total = 0;
  const start = now - hours * HOUR;
  for (let b = Math.floor(start / HOUR); b <= Math.floor(now / HOUR); b++)
    for (const c of CAMERAS)
      if (cameraOnline(c.id, b * HOUR))
        total +=
          Math.max(
            0,
            Math.min(now, (b + 1) * HOUR) - Math.max(start, b * HOUR),
          ) / HOUR;
  return total;
}
export function speciesName(id: string) {
  return SPECIES.find((s) => s.id === id)?.name ?? id;
}
export type Review = { label: SpeciesId | "empty" | "unknown"; at: number };
export const captureLabel = (c: Capture, review?: Review) =>
  review?.label ?? (c.empty ? "empty" : c.species);
