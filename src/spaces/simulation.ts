import type { DemoSensor, Experience, Sample, ScenarioState } from "./types";
const MIN = 60000,
  HOUR = 60 * MIN,
  DAY = 24 * HOUR;
export const NORMAL: ScenarioState = { id: "normal", since: 0 };
const fmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Rome",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
interface LocalTime {
  hour: number;
  month: number;
  weekend: boolean;
  date: string;
}
const times = new Map<number, LocalTime>();
export function localTime(t: number): LocalTime {
  const key = Math.floor(t / MIN);
  const cached = times.get(key);
  if (cached) return cached;
  const p = Object.fromEntries(
    fmt.formatToParts(t).map((p) => [p.type, p.value]),
  );
  const r = {
    hour: Number(p.hour) + Number(p.minute) / 60,
    month: Number(p.month),
    weekend: p.weekday === "Sat" || p.weekday === "Sun",
    date: `${p.year}-${p.month}-${p.day}`,
  };
  if (times.size > 6000) times.clear();
  times.set(key, r);
  return r;
}
const dayStarts = new Map<string, number>();
export function localDayStart(t: number): number {
  const date = localTime(t).date;
  if (dayStarts.has(date)) return dayStarts.get(date)!;
  let a = t - 36 * HOUR,
    b = t;
  for (let i = 0; i < 35; i++) {
    const m = (a + b) / 2;
    if (localTime(m).date < date) a = m;
    else b = m;
  }
  const result = Math.round(b / MIN) * MIN;
  dayStarts.set(date, result);
  if (dayStarts.size > 20) dayStarts.delete(dayStarts.keys().next().value!);
  return result;
}
function seed(s: string): number {
  let v = 2166136261;
  for (const c of s) {
    v ^= c.charCodeAt(0);
    v = Math.imul(v, 16777619);
  }
  return v >>> 0;
}
function random(n: number): number {
  let v = n | 0;
  v = Math.imul(v ^ (v >>> 16), 0x45d9f3b);
  v = Math.imul(v ^ (v >>> 16), 0x45d9f3b);
  return ((v ^ (v >>> 16)) >>> 0) / 4294967295;
}
export function noise(key: string, t: number, period = 15 * MIN): number {
  const x = t / period,
    i = Math.floor(x),
    f = x - i,
    s = f * f * (3 - 2 * f),
    n = seed(key);
  return (1 - s) * (random(n + i) * 2 - 1) + s * (random(n + i + 1) * 2 - 1);
}
const gaussian = (x: number, m: number, w: number) =>
  Math.exp(-0.5 * ((x - m) / w) ** 2);
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
function ramp(t: number, s: ScenarioState): number {
  return s.id === "normal" || t < s.since
    ? 0
    : 1 - Math.exp(-(t - s.since) / (4 * MIN));
}
export function demand(
  site: Experience,
  t: number,
  s: ScenarioState = NORMAL,
): number {
  const { hour: h, weekend } = localTime(t),
    r = ramp(t, s),
    peak = s.id === "peak" ? r : 0,
    rain = s.id === "rain" ? r : 0;
  if (site.id === "retail") {
    const close = peak > 0.1 ? 23 : 20.5;
    if (h < 8.8 || h > close) return 0;
    const edge = Math.min(1, (h - 8.8) / 0.7, (close - h) / 0.5);
    return Math.max(
      0,
      edge *
        (270 + 600 * gaussian(h, 12.2, 1.4) + 850 * gaussian(h, 17.3, 1.8)) *
        (weekend ? 1.25 : 0.9) *
        (1 + 0.6 * peak + 0.18 * rain) *
        (1 + 0.05 * noise("retail-flow", t)),
    );
  }
  if (site.id === "vineyard") {
    if (h < 8.8 || h > 18.5) return 0;
    return (
      (8 + 30 * gaussian(h, 11, 1) + 40 * gaussian(h, 15.5, 1.3)) *
      (weekend ? 1.25 : 0.65) *
      (1 - 0.5 * rain) *
      (1 + 0.04 * noise("wine-flow", t))
    );
  }
  if (site.id === "mountain") {
    if (h < 7.5 || h > 18) return 0;
    const month = localTime(t).month,
      season = [12, 1, 2, 3, 7, 8].includes(month) ? 1 : 0.45,
      efficient = s.id === "efficient" ? r : 0;
    const ordinary =
        20 + 160 * gaussian(h, 9.8, 1.5) + 100 * gaussian(h, 13, 1.8),
      spread = 20 + 120 * gaussian(h, 10.1, 2) + 82 * gaussian(h, 13.2, 2.2);
    return (
      (ordinary * (1 - efficient) + spread * efficient) *
      season *
      (weekend ? 1.45 : 0.85) *
      (1 + 0.8 * peak) *
      (1 - 0.65 * rain)
    );
  }
  return 0;
}
const presenceCache = new Map<string, number>();
export function presence(
  site: Experience,
  t: number,
  s: ScenarioState = NORMAL,
): number {
  t = Math.floor(t / MIN) * MIN;
  const key = `${site.id}:${t}:${s.id}:${s.since}`;
  if (presenceCache.has(key)) return presenceCache.get(key)!;
  const dwell = site.id === "retail" ? 75 : site.id === "mountain" ? 140 : 70;
  let total = 0;
  for (let age = 2.5; age < 360; age += 5)
    total +=
      ((demand(site, t - age * MIN, s) * 5) / 60) * Math.exp(-age / dwell);
  const cap = site.id === "retail" ? 1500 : site.id === "mountain" ? 690 : 90;
  const value = Math.round(clamp(total, 0, cap));
  if (presenceCache.size > 1600) presenceCache.clear();
  presenceCache.set(key, value);
  return value;
}
const dailyCache = new Map<string, number>();
export function dailyEntries(
  site: Experience,
  t: number,
  s: ScenarioState = NORMAL,
): number {
  t = Math.floor(t / MIN) * MIN;
  const key = `${site.id}:${t}:${s.id}:${s.since}`;
  if (dailyCache.has(key)) return dailyCache.get(key)!;
  const start = localDayStart(t);
  let total = 0;
  for (let at = start; at < t; at += 5 * MIN) {
    const dt = Math.min(5 * MIN, t - at);
    total += (demand(site, at + dt / 2, s) * dt) / HOUR;
  }
  const value = Math.round(total);
  if (dailyCache.size > 250) dailyCache.clear();
  dailyCache.set(key, value);
  return value;
}
export function zonePeople(
  site: Experience,
  t: number,
  s: ScenarioState = NORMAL,
): Record<string, number> {
  const total = presence(site, t, s),
    zones = site.zones.filter((z) => z.share),
    h = localTime(t).hour;
  const weights = zones.map(
    (z) =>
      z.share! *
      (site.id === "retail" && z.id === "food"
        ? 1 + gaussian(h, 12.5, 1.2) + 0.6 * gaussian(h, 19, 1)
        : 1),
  );
  const sum = weights.reduce((a, v) => a + v, 0) || 1;
  const result: Record<string, number> = {};
  zones.forEach(
    (z, i) =>
      (result[z.id] = Math.min(
        z.capacity ?? Infinity,
        Math.floor((total * weights[i]!) / sum),
      )),
  );
  let remaining = total - Object.values(result).reduce((a, v) => a + v, 0);
  for (const z of [...zones].sort(
    (a, b) => (b.capacity ?? 0) - (a.capacity ?? 0),
  )) {
    const add = Math.min(
      remaining,
      Math.max(0, (z.capacity ?? Infinity) - result[z.id]!),
    );
    result[z.id]! += add;
    remaining -= add;
  }
  return result;
}
export function trafficAt(
  site: Experience,
  t: number,
  s: ScenarioState = NORMAL,
  index = 0,
): { flow: number; speed: number; queue: number; ratio: number } {
  const h = localTime(t).hour,
    r = ramp(t, s),
    capacity =
      (site.routes[index]?.capacity ?? 900) *
      (s.id === "rain" ? 1 - 0.2 * r : s.id === "efficient" ? 1 + 0.12 * r : 1);
  const weekend = localTime(t).weekend;
  const profile =
    0.12 +
    (weekend ? 0.35 : 0.85) * gaussian(h, 7.8, 1) +
    (weekend ? 0.65 : 0.9) * gaussian(h, 17.7, 1.6) +
    0.4 * gaussian(h, 12.3, 1.8);
  const arriving =
    (site.routes[index]?.capacity ?? 900) *
    profile *
    (s.id === "peak" ? 1 + 0.35 * r : 1) *
    (1 + 0.06 * noise(`traffic-${index}`, t));
  const ratio = arriving / capacity;
  return {
    flow: Math.round(Math.min(arriving, capacity * 1.1)),
    speed: clamp(
      50 * (1 - 0.68 * ratio ** 1.5) * (s.id === "rain" ? 1 - 0.18 * r : 1),
      7,
      52,
    ),
    queue: Math.round(Math.max(0, (arriving - capacity * 0.67) * 0.05)),
    ratio,
  };
}
export function reading(
  site: Experience,
  sensor: DemoSensor,
  t: number,
  scenario: ScenarioState = NORMAL,
): Sample {
  const h = localTime(t).hour,
    n = noise(sensor.id, t),
    slow = noise(sensor.id, t, 90 * MIN),
    r = ramp(t, scenario),
    peak = scenario.id === "peak" ? r : 0,
    rain = scenario.id === "rain" ? r : 0,
    efficient = scenario.id === "efficient" ? r : 0;
  const duty =
    site.id === "industry"
      ? h >= 6 && h < 22
        ? 1
        : 0.72
      : h >= 8 && h < 20
        ? 1
        : 0.35;
  const month = localTime(t).month,
    daylight = Math.max(0, Math.sin((Math.PI * (h - 7)) / 10));
  const annual = 12 + 10 * Math.cos(((month - 7) / 12) * 2 * Math.PI);
  let v = sensor.base + sensor.amplitude * (0.6 * n + 0.4 * slow);
  switch (sensor.metric) {
    case "power":
      v = (sensor.base + sensor.amplitude * n) * duty * (1 + 0.3 * peak);
      if (site.id === "retail")
        v =
          100 +
          170 * (h > 8 && h < 21 ? 1 : 0) +
          presence(site, t, scenario) * 0.17;
      v *= 1 - 0.13 * efficient;
      break;
    case "solar":
      v = Math.max(
        0,
        sensor.base * daylight * (0.75 + 0.15 * slow) * (1 - 0.78 * rain),
      );
      break;
    case "temperature":
      if (sensor.base === 0)
        v =
          annual +
          4 * Math.sin(((h - 8) / 24) * 2 * Math.PI) +
          n * 0.5 +
          5 * peak -
          3 * rain -
          (site.id === "mountain" ? 9 : 0);
      else if (site.id === "industry" && sensor.zone === "production")
        v += 8 * peak;
      break;
    case "vibration":
      v += 2.2 * gaussian(h, 13.6, 0.3) + 0.9 * peak - 0.15 * efficient;
      break;
    case "pressure":
      v -= 0.65 * peak;
      break;
    case "water":
      if (site.id === "vineyard") {
        const irrigating = (h >= 5.5 && h < 7.5) || (h >= 18 && h < 19);
        v = irrigating
          ? sensor.base * (1 + 0.5 * peak) * (1 - 0.35 * efficient) * (1 - rain)
          : 0;
      } else v *= duty * (1 + 0.2 * peak - 0.15 * efficient);
      break;
    case "moisture":
      v -= 2 * Math.sin(((h - 7) / 24) * 2 * Math.PI) + 6 * peak;
      v += 9 * rain + 1.5 * efficient;
      break;
    case "humidity":
      v += 16 * rain - 8 * peak;
      break;
    case "tank":
      v -= 9 * peak;
      v += 7 * rain + 5 * efficient;
      break;
    case "entries":
      v = demand(site, t, scenario) * sensor.base;
      break;
    case "people":
      v =
        site.id === "vineyard"
          ? presence(site, t, scenario)
          : (zonePeople(site, t, scenario)[sensor.zone] ?? 0);
      break;
    case "parking": {
      const capacity = sensor.capacity ?? sensor.base;
      const used =
        site.id === "traffic"
          ? 35 + 70 * gaussian(h, 10, 3) + 35 * gaussian(h, 17, 2)
          : presence(site, t, scenario) *
              (site.id === "mountain" ? 0.55 : 0.32) +
            (h > 7 && h < 22 ? capacity * 0.12 : capacity * 0.02);
      v = capacity - clamp(Math.round(used), 0, capacity);
      break;
    }
    case "co2":
      v =
        sensor.base +
        (site.id === "retail"
          ? presence(site, t, scenario) * 0.45
          : sensor.amplitude * (1 + n) * duty);
      v *= 1 - 0.12 * efficient;
      break;
    case "flow":
      if (site.id === "traffic")
        v = trafficAt(
          site,
          t,
          scenario,
          Number(sensor.id.split("-").at(-1)) || 0,
        ).flow;
      else
        v *=
          duty *
          (1 + 0.5 * peak) *
          (1 +
            0.65 * gaussian(h, 6, 1) +
            0.6 * gaussian(h, 14, 1) +
            0.3 * gaussian(h, 22, 1));
      break;
    case "speed":
      v = trafficAt(
        site,
        t,
        scenario,
        Number(sensor.id.split("-").at(-1)) || 0,
      ).speed;
      break;
    case "queue":
      v =
        site.id === "traffic"
          ? trafficAt(
              site,
              t,
              scenario,
              Number(sensor.id.split("-").at(-1)) || 0,
            ).queue
          : Math.max(0, sensor.base + sensor.amplitude * n + 5 * peak);
      break;
    case "wind":
      v = sensor.base + sensor.amplitude * (0.6 + 0.8 * n) + 35 * rain;
      break;
    case "lift": {
      const wind = site.sensors.find((a) => a.metric === "wind");
      v =
        wind && reading(site, wind, t, scenario).value > 60
          ? 0
          : Math.min(sensor.capacity ?? 850, demand(site, t, scenario) * 1.3);
      break;
    }
  }
  if (["humidity", "moisture", "tank"].includes(sensor.metric))
    v = clamp(v, 0, 100);
  if (sensor.metric !== "temperature") v = Math.max(0, v);
  if (
    ["people", "parking", "entries", "flow", "queue", "lift", "co2"].includes(
      sensor.metric,
    )
  )
    v = Math.round(v);
  let status: Sample["status"] = "normal";
  if (sensor.high !== undefined && v > sensor.high)
    status = v > sensor.high * 1.3 ? "alert" : "watch";
  if (sensor.low !== undefined && v < sensor.low)
    status = v < sensor.low * 0.65 ? "alert" : "watch";
  if (
    sensor.metric === "people" &&
    sensor.capacity &&
    v >= sensor.capacity * 0.9
  )
    status = v >= sensor.capacity ? "alert" : "watch";
  return {
    value: v,
    status,
    label:
      status === "normal"
        ? "Nel profilo"
        : status === "watch"
          ? "Da osservare"
          : "Fuori profilo",
  };
}
export function formatValue(value: number, unit: string): string {
  return new Intl.NumberFormat("it-IT", {
    maximumFractionDigits: [
      "persone",
      "passaggi/h",
      "veicoli/h",
      "posti liberi",
      "veicoli",
      "persone/h",
      "ppm",
    ].includes(unit)
      ? 0
      : unit === "mm/s"
        ? 2
        : 1,
  }).format(value);
}
export function history(
  site: Experience,
  sensor: DemoSensor,
  t: number,
  s: ScenarioState = NORMAL,
  hours = 24,
): { time: number; value: number }[] {
  const end = Math.floor(t / MIN) * MIN;
  return Array.from({ length: 97 }, (_, i) => {
    const time = end - ((96 - i) * hours * HOUR) / 96;
    return { time, value: reading(site, sensor, time, s).value };
  });
}
function routeLengths(route: Experience["routes"][number]): number[] {
  const coords = route.coordinates,
    lat = coords[0]?.[1] ?? 46,
    lengths = [0];
  for (let i = 1; i < coords.length; i++)
    lengths.push(
      lengths.at(-1)! +
        Math.hypot(
          (coords[i]![0] - coords[i - 1]![0]) *
            111320 *
            Math.cos((lat * Math.PI) / 180),
          (coords[i]![1] - coords[i - 1]![1]) * 110574,
        ),
    );
  return lengths;
}
export function positionOnRoute(
  route: Experience["routes"][number],
  distance: number,
): [number, number] {
  const lengths = routeLengths(route),
    total = lengths.at(-1)! || 1,
    target = clamp(distance, 0, total);
  let k = 1;
  while (k < lengths.length - 1 && lengths[k]! < target) k++;
  const f =
    (target - lengths[k - 1]!) / Math.max(0.001, lengths[k]! - lengths[k - 1]!);
  const a = route.coordinates[k - 1] ?? route.coordinates[0]!,
    b = route.coordinates[k] ?? a;
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
}
/** Stable entry slots: each aggregate symbol keeps its entry speed for its trip. */
export function virtualTrips(
  scene: Experience,
  routeIndex: number,
  t: number,
  s: ScenarioState = NORMAL,
): { id: string; coordinates: [number, number] }[] {
  const route = scene.routes[routeIndex]!,
    length = routeLengths(route).at(-1)!;
  const step =
    route.kind === "traffic"
      ? 10000
      : route.kind === "logistics"
        ? 90000
        : route.kind === "lift"
          ? 15000
          : 30000;
  const minimum =
      route.kind === "traffic"
        ? 7
        : route.kind === "visitors"
          ? 4
          : route.kind === "lift"
            ? 12
            : 14,
    maxAge = (length / (minimum / 3.6)) * 1000;
  const slot = Math.floor(t / step),
    out: { id: string; coordinates: [number, number] }[] = [];
  for (let i = 0; i <= Math.min(400, Math.ceil(maxAge / step)); i++) {
    const entry = (slot - i) * step,
      traffic =
        scene.id === "traffic" ? trafficAt(scene, entry, s, routeIndex) : null;
    let flow =
      traffic?.flow ??
      (route.kind === "logistics" ? 18 : demand(scene, entry, s));
    if (route.kind === "lift") {
      const lift = scene.sensors.find((a) => a.metric === "lift");
      if (lift) flow = reading(scene, lift, entry, s).value;
    }
    if (
      random(seed(`${route.id}:${slot - i}`)) >
      clamp(flow / route.capacity, 0, 1)
    )
      continue;
    const speed = traffic?.speed ?? minimum,
      distance = (((t - entry) / 1000) * speed) / 3.6;
    if (distance > length) continue;
    out.push({
      id: `${route.id}:${slot - i}`,
      coordinates: positionOnRoute(route, distance),
    });
  }
  return out;
}
export function simulatedEvents(
  site: Experience,
  t: number,
): { id: string; time: number; title: string; zone: string; detail: string }[] {
  const labels =
    site.id === "traffic"
      ? ["Domanda pendolare", "Ricambio della sosta", "Confronto dei nodi"]
      : site.id === "retail"
        ? [
            "Cambio del flusso in galleria",
            "Ricambio dei posti auto",
            "Passaggi tra negozi",
          ]
        : site.id === "industry"
          ? [
              "Cambio turno virtuale",
              "Ciclo della linea 02",
              "Movimentazione al varco",
            ]
          : site.id === "vineyard"
            ? [
                "Controllo dei filari",
                "Ciclo della riserva idrica",
                "Visite in tenuta",
              ]
            : [
                "Aggiornamento degli accessi",
                "Lettura del vento in quota",
                "Distribuzione sui percorsi",
              ];
  const bucket = Math.floor(t / (2 * HOUR)),
    out: {
      id: string;
      time: number;
      title: string;
      zone: string;
      detail: string;
    }[] = [];
  for (let i = 0; out.length < 5; i++) {
    const absolute = bucket - i,
      key = seed(`${site.id}:${absolute}`),
      time = absolute * 2 * HOUR + ((key % 35) + 5) * MIN;
    if (time > t) continue;
    out.push({
      id: `${site.id}:${absolute}`,
      time,
      title: labels[key % labels.length]!,
      zone: site.zones[key % site.zones.length]!.id,
      detail:
        "Evento generato dal modello dimostrativo; non una segnalazione reale.",
    });
  }
  return out;
}
export const TIME = { MIN, HOUR, DAY };
