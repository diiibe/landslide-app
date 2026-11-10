import area from "@turf/area";
import { demand, localTime, reading, trafficAt, roadPerformance, zonePeople, TIME } from "../simulation";
import type { Experience, ScenarioState } from "../types";
export type Point = { time: number; value: number };
const sum = (v: number[]) => v.reduce((a, b) => a + b, 0);
export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, Number.isFinite(v) ? v : min));
const ticks = (end: number, hours: number) => {
  const n = Math.max(1, Math.round(hours * 12));
  return Array.from({ length: n + 1 }, (_, i) => end - hours * TIME.HOUR + i * hours * TIME.HOUR / n);
};
export function integral(points: Point[]) {
  return points.slice(1).reduce((total, p, i) => total + (p.value + points[i]!.value) / 2 * (p.time - points[i]!.time) / TIME.HOUR, 0);
}
export function energyReport(site: Experience, end: number, hours: number, scenario: ScenarioState, reduction: number, tariff: number, zone = "all") {
  const sensors = site.sensors.filter(s => zone === "all" || s.zone === zone);
  const load = (t: number) => sum(sensors.filter(s => s.metric === "power").map(s => reading(site, s, t, scenario).value));
  // PV is credited only for the same scope. A department is not allocated the
  // entire site's generation, and export is never treated as negative import.
  const pv = (t: number) => sum(sensors.filter(s => s.metric === "solar").map(s => reading(site, s, t, scenario).value));
  const times = ticks(end, hours), cut = clamp(reduction, 0, 50) / 100;
  const baseline = times.map(time => ({ time, value: Math.max(0, load(time) - pv(time)) }));
  const proposal = times.map(time => ({ time, value: Math.max(0, load(time) * (1 - cut) - pv(time)) }));
  const production = times.map(time => ({ time, value: pv(time) }));
  const imported = integral(baseline), planned = integral(proposal);
  return { baseline, proposal, imported, planned, solar: integral(production), saved: imported - planned,
    peak: Math.max(...baseline.map(p => p.value)), proposedPeak: Math.max(...proposal.map(p => p.value)),
    cost: imported * clamp(tariff, 0, 2), proposedCost: planned * clamp(tariff, 0, 2) };
}
export function irrigationReport(site: Experience, time: number, scenario: ScenarioState, target: number, rootCm: number, efficiency: number, rainMm: number, reserve: number) {
  const zones = site.zones.flatMap(zone => {
    const probes = site.sensors.filter(s => s.zone === zone.id && s.metric === "moisture");
    if (!probes.length) return [];
    const moisture = sum(probes.map(s => reading(site, s, time, scenario).value)) / probes.length;
    const m2 = area(zone.geometry), deficitMm = Math.max(0, (clamp(target, 10, 50) - moisture) / 100 * clamp(rootCm, 10, 100) * 10 - clamp(rainMm, 0, 50));
    const net = deficitMm * m2 / 1000, gross = net / (clamp(efficiency, 50, 100) / 100);
    const nominalFlow = sum(site.sensors.filter(s => s.zone === zone.id && s.metric === "water").map(s => s.base));
    return [{ id: zone.id, name: zone.name, probes: probes.length, moisture, m2, deficitMm, net, gross, hours: nominalFlow > 0 ? gross / nominalFlow : null }];
  });
  const gross = sum(zones.map(z => z.gross)), available = clamp(reserve, 0, 5000);
  return { zones, gross, net: sum(zones.map(z => z.net)), available, shortfall: Math.max(0, gross - available) };
}
export function retailReport(site: Experience, end: number, scenario: ScenarioState, zoneId: string, peoplePerStaff: number, onDuty: number, hours: number) {
  const monitored = site.zones.filter(z => z.share && (zoneId === "all" || z.id === zoneId));
  const count = (time: number) => { const people = zonePeople(site, time, scenario); return sum(monitored.map(z => people[z.id] ?? 0)); };
  const points = ticks(end, hours).map(time => ({ time, value: count(time) }));
  const current = count(end), peakPoint = points.reduce((a, b) => a.value >= b.value ? a : b);
  const zones = monitored.map(z => ({ id: z.id, name: z.name, people: zonePeople(site, end, scenario)[z.id] ?? 0, capacity: z.capacity ?? null, m2: area(z.geometry) }));
  const ratio = clamp(peoplePerStaff, 10, 200), staff = Math.round(clamp(onDuty, 0, 100));
  return { points, zones, current, peak: peakPoint.value, peakTime: peakPoint.time,
    staffNow: Math.ceil(current / ratio), staffAtPeak: Math.ceil(peakPoint.value / ratio), onDuty: staff,
    gap: Math.max(0, Math.ceil(current / ratio) - staff) };
}
export function trafficReport(site: Experience, end: number, scenario: ScenarioState, index: number, capacityPct: number, hours: number) {
  const pct = clamp(capacityPct, 30, 120) / 100;
  const at = (time: number) => {
    const state = trafficAt(site, time, scenario, index);
    return { before: state, after: roadPerformance(state.arrivals, state.capacity * pct, state.weatherFactor) };
  };
  const baseline = ticks(end, hours).map(time => ({ time, value: at(time).before.speed }));
  const proposal = ticks(end, hours).map(time => ({ time, value: at(time).after.speed }));
  const current = at(end);
  // Geometry length includes the published illustrative connections; it is
  // a section travel-time indicator, not a routing/ETA service.
  const coords = site.routes[index]?.coordinates ?? [];
  const lengthKm = sum(coords.slice(1).map((b, i) => {
    const a = coords[i]!, rad = Math.PI / 180, dLat = (b[1] - a[1]) * rad, dLon = (b[0] - a[0]) * rad;
    return 12742 * Math.asin(Math.min(1, Math.sqrt(Math.sin(dLat/2)**2 + Math.cos(a[1]*rad)*Math.cos(b[1]*rad)*Math.sin(dLon/2)**2)));
  }));
  return { ...current, baseline, proposal, lengthKm, minutesBefore: lengthKm / current.before.speed * 60, minutesAfter: lengthKm / current.after.speed * 60 };
}
export function mountainReport(site: Experience, start: number, scenario: ScenarioState, quotaPct: number, nominalCapacity: number) {
  const windSensor = site.sensors.find(s => s.metric === "wind")!, threshold = windSensor.high ?? 60;
  const quota = clamp(quotaPct, 30, 100) / 100, capacity = clamp(nominalCapacity, 100, 1200);
  let offered = 0, admitted = 0, served = 0, ordinaryQueue = 0, queue = 0, pausedMinutes = 0;
  let expected = 0, seatsRemainder = 0, ordinaryRemainder = 0;
  const baseline: Point[] = [{ time: start, value: 0 }], proposal: Point[] = [{ time: start, value: 0 }];
  for (let i = 0; i < 24; i++) {
    const t = start + (i + .5) * 5 * TIME.MIN, hour = localTime(t).hour;
    const incoming = demand(site, t, scenario) * 5 / 60;
    const wind = reading(site, windSensor, t, scenario).value;
    const open = hour >= 7.5 && hour <= 18 && wind <= threshold;
    const seats = open ? capacity * 5 / 60 + seatsRemainder : 0;
    const ordinarySeats = open ? (site.sensors.find(s => s.metric === "lift")?.capacity ?? 850) * 5 / 60 + ordinaryRemainder : 0;
    const service = Math.floor(seats), ordinaryService = Math.floor(ordinarySeats);
    seatsRemainder = seats - service; ordinaryRemainder = ordinarySeats - ordinaryService;
    if (!open) pausedMinutes += 5;
    expected += incoming;
    const incomingCount = Math.floor(expected) - offered;
    offered += incomingCount;
    const passed = Math.floor(offered * quota) - admitted;
    admitted += passed;
    ordinaryQueue = Math.max(0, ordinaryQueue + incomingCount - ordinaryService);
    const out = Math.min(queue + passed, service); served += out;
    queue = Math.max(0, queue + passed - out);
    const time = start + (i + 1) * 5 * TIME.MIN;
    baseline.push({ time, value: ordinaryQueue }); proposal.push({ time, value: queue });
  }
  return { baseline, proposal, offered, admitted, deferred: offered - admitted, served, queue, pausedMinutes, threshold,
    peak: Math.max(...proposal.map(p => p.value)), wind: reading(site, windSensor, start, scenario).value };
}
