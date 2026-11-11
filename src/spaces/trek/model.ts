import network from "./network.json";
export const FIRMWARE = {
  commit: "3f9ddfd06ab6aba12bb8028a6b15f8f1f243fbff",
  url: "https://github.com/cariddi-stefano/firmware-smart-trek",
  specification: "v0.2 · sorgente corrente, migrazione non completata",
};
export const NODES = network.markers;
export type TrekNode = (typeof NODES)[number];
export type TrekMode = "normal" | "uplink" | "supply";
export interface TrekScenario {
  mode: TrekMode;
  since: number;
}
export interface TrekSample {
  nodeId: string;
  at: number;
  msgId: number;
  espMv: number;
  espMa: number;
  radioMv: number;
  radioMa: number;
  powerMw: number;
  ble: number;
  checkins: number;
  peakRssi: number | null;
  linkRssi: number;
  hops: number;
  airtime: number;
  timeSynced: boolean;
  railOut: boolean;
  masterAt: number;
  cloudAt: number;
}
const TEN = 600000;
export const NORMAL: TrekScenario = { mode: "normal", since: 0 };
const hash = (n: number) => {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};
const civil = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Rome",
  hour: "2-digit",
  minute: "2-digit",
  month: "numeric",
  weekday: "short",
  hourCycle: "h23",
});
const round = (n: number) => Math.round(n * 10) / 10;
/** Deterministic absolute slots, phase offset + bounded jitter: 9–11 min gaps. */
export function sampleTime(node: TrekNode, slot: number) {
  return (
    slot * TEN +
    (node.number % 8) * 61000 +
    (hash(slot + node.number) * 2 - 1) * 30000
  );
}
export function latestSlot(node: TrekNode, time: number) {
  let slot = Math.floor((time - (node.number % 8) * 61000) / TEN);
  while (sampleTime(node, slot) > time) slot--;
  while (sampleTime(node, slot + 1) <= time) slot++;
  return slot;
}
export function sample(
  node: TrekNode,
  slot: number,
  scenario: TrekScenario = NORMAL,
): TrekSample {
  const at = sampleTime(node, slot),
    parts = civil.formatToParts(at);
  const part = (key: string) => parts.find((p) => p.type === key)!.value;
  const hour = Number(part("hour")) + Number(part("minute")) / 60;
  const daylight = Math.max(0, Math.sin(((hour - 7) * Math.PI) / 12));
  const weekend = ["Sat", "Sun"].includes(part("weekday")) ? 1.6 : 1;
  const season =
    0.35 +
    0.65 * Math.max(0, Math.sin(((Number(part("month")) - 2) * Math.PI) / 12));
  const ble = Math.floor(
    hash(slot + node.number * 31) * (2 + daylight * 17 * weekend * season),
  );
  const checkins = Math.floor(
    ble * (0.15 + hash(slot + node.number * 17) * 0.25),
  );
  const fault =
    scenario.mode === "supply" && node.number === 106 && at >= scenario.since;
  const espMv = Math.round(
    (fault ? 3090 : 3305) + (hash(slot + node.number) - 0.5) * 26,
  );
  const radioMv = Math.round(
    (fault ? 3070 : 3295) + (hash(slot + node.number * 2) - 0.5) * 32,
  );
  const espMa = round(22 + daylight * 9 + ble * 0.7 + hash(slot + 3) * 3);
  const radioMa = round(2.5 + hash(slot + node.number * 5) * 5);
  const powerMw = Math.round(
    (espMv * espMa) / 1000 + (radioMv * radioMa) / 1000,
  );
  let hops = 0,
    relay: TrekNode | undefined = node;
  while (relay?.next && hops < NODES.length) {
    hops++;
    relay = NODES.find((n) => n.id === relay!.next);
  }
  const masterAt = at + 500 + hops * 1200;
  let cloudAt = masterAt + 1800;
  if (
    scenario.mode === "uplink" &&
    masterAt >= scenario.since &&
    masterAt < scenario.since + 40 * 60000
  )
    cloudAt =
      scenario.since + 40 * 60000 + (((slot % 5) + 5) % 5) * 1500 + hops * 400;
  return {
    nodeId: node.id,
    at,
    msgId: ((slot % 65536) + 65536) % 65536,
    espMv,
    espMa,
    radioMv,
    radioMa,
    powerMw,
    ble,
    checkins,
    peakRssi: ble > 0 ? -48 - Math.round(hash(slot + node.number) * 27) : null,
    linkRssi: -68 - Math.round(hash(slot + node.number * 3) * 35),
    hops,
    airtime: round(1 + hops * 0.35 + ble * 0.08),
    timeSynced: node.number !== 107 || ((slot % 12) + 12) % 12 !== 0,
    railOut: espMv < 3150 || espMv > 3450 || radioMv < 3150 || radioMv > 3450,
    masterAt,
    cloudAt,
  };
}
export function samples(
  node: TrekNode,
  start: number,
  end: number,
  scenario: TrekScenario = NORMAL,
) {
  const result: TrekSample[] = [];
  for (
    let slot = latestSlot(node, start) - 1;
    slot <= latestSlot(node, end);
    slot++
  ) {
    const s = sample(node, slot, scenario);
    if (s.at >= start && s.at <= end) result.push(s);
  }
  return result;
}
export function nodeState(
  node: TrekNode,
  time: number,
  scenario: TrekScenario = NORMAL,
) {
  let slot = latestSlot(node, time),
    current = sample(node, slot, scenario);
  while (current.cloudAt > time) current = sample(node, --slot, scenario);
  const age = time - current.at;
  return {
    sample: current,
    age,
    status:
      age > 22 * 60000
        ? ("delayed" as const)
        : current.railOut
          ? ("power" as const)
          : !current.timeSynced
            ? ("time" as const)
            : ("ok" as const),
  };
}
export function windowReport(
  time: number,
  hours: number,
  scenario: TrekScenario = NORMAL,
) {
  const all = NODES.flatMap((n) =>
    samples(n, time - hours * 3600000, time, scenario),
  );
  const stored = all.filter((s) => s.cloudAt <= time),
    pending = all.filter((s) => s.cloudAt > time);
  return {
    all,
    stored,
    pending,
    total: all.length,
    confirmed: stored.length,
    waiting: pending.length,
    ble: stored.reduce((v, s) => v + s.ble, 0),
    checkins: stored.reduce((v, s) => v + s.checkins, 0),
  };
}
export function firmwareJSON(node: TrekNode, s: TrekSample) {
  return {
    demo: true,
    source_commit: FIRMWARE.commit,
    contract: "Esempio JSON v0.2, non un endpoint collegato",
    gateway_id: "DEMO_PORDENONE",
    node_id: node.number,
    msg_id: s.msgId,
    msg_type: "TELEMETRY",
    net_mode: "MESH",
    hops: s.hops,
    power: {
      esp32: { rail_mv: s.espMv, current_ma: s.espMa },
      radio: { rail_mv: s.radioMv, current_ma: s.radioMa },
      total_mw: s.powerMw,
    },
    presence: {
      ble_adv_count: s.ble,
      app_checkins: s.checkins,
      peak_rssi: s.peakRssi,
    },
    active_alert_id: 0,
    airtime_s_1h: s.airtime,
    status: {
      time_synced: s.timeSynced,
      rail_out_of_range: s.railOut,
      radio_recovered: false,
    },
    lora_link: { rssi: s.linkRssi },
    sample_at: new Date(s.at).toISOString(),
    received_at: new Date(s.masterAt).toISOString(),
    cloud_stored_at: new Date(s.cloudAt).toISOString(),
  };
}
export const stateLabel = {
  ok: "Campione recente",
  delayed: "Dati in ritardo",
  power: "Tensione da verificare",
  time: "Ora nodo non sincronizzata",
};
export const stateTone = {
  ok: "#86b79b",
  delayed: "#a2a79d",
  power: "#e69a63",
  time: "#c9b57c",
};
