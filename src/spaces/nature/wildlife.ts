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
export const CAMERAS = Array.from({ length: 8 }, (_, i) => ({
  id: `cam-${i + 1}`,
  name: `Fototrappola ${String(i + 1).padStart(2, "0")}`,
  coordinates: [
    13.168 + (i % 4) * 0.005,
    46.466 + Math.floor(i / 4) * 0.009,
  ] as [number, number],
  habitat: ["Margine del bosco", "Radura", "Bosco misto", "Sentiero forestale"][
    i % 4
  ]!,
}));
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
