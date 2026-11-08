import { useEffect } from "react";
import { startPolling } from "./polling";
import {
  getJSON,
  parseMeasures,
  parseRadar,
  PCR_API,
  TWIN_DATA,
  type RadarFrame,
} from "./data";
import { useTwinStore, type FeedState } from "./store";
const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "Fonte non raggiungibile";
async function sensors(signal: AbortSignal) {
  const update = (patch: Partial<FeedState>) =>
    useTwinStore.setState((s) => ({
      sensorsFeed: { ...s.sensorsFeed, ...patch },
    }));
  update({ loading: true });
  try {
    const measures = parseMeasures(
      await getJSON(`${PCR_API}/measures/latest`, signal),
    );
    if (signal.aborted) return;
    useTwinStore.setState({ measures });
    update({
      loading: false,
      error: null,
      receivedAt: Date.now(),
      snapshot: false,
    });
  } catch (e) {
    if (signal.aborted) return;
    update({ loading: false, error: errorText(e) });
    if (!useTwinStore.getState().measures.length)
      try {
        const measures = parseMeasures(
          await getJSON(`${TWIN_DATA}sensors-snapshot.json`, signal),
        );
        if (!signal.aborted) {
          useTwinStore.setState({ measures });
          update({ snapshot: true });
        }
      } catch {
        /* The live error remains visible; no invented observations. */
      }
  }
}
async function imageDataURL(url: string, signal: AbortSignal): Promise<string> {
  const r = await fetch(url, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]),
    cache: "no-store",
  });
  if (!r.ok || !r.headers.get("content-type")?.includes("image/png"))
    throw new Error("Immagine radar non disponibile");
  const blob = await r.blob();
  if (blob.size > 10 * 1024 * 1024)
    throw new Error("Immagine radar troppo grande");
  const bitmap = await createImageBitmap(blob);
  bitmap.close();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Immagine radar non leggibile"));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}
async function radar(signal: AbortSignal) {
  const update = (patch: Partial<FeedState>) =>
    useTwinStore.setState((s) => ({ radarFeed: { ...s.radarFeed, ...patch } }));
  update({ loading: true });
  try {
    const raw = (await getJSON(
      `${PCR_API}/radars/1/products?last=100`,
      signal,
    )) as { products?: unknown[]; result?: string };
    if (raw.result !== "OK" || !Array.isArray(raw.products))
      throw new Error("Elenco radar non valido");
    const frames: RadarFrame[] = [];
    for (const row of raw.products) {
      try {
        frames.push(parseRadar(row));
      } catch {
        /* Other formats and products are not SRI images. */
      }
    }
    frames.sort((a, b) => b.ms - a.ms);
    const latest = frames[0];
    if (!latest) throw new Error("Nessun prodotto SRI disponibile");
    const old = useTwinStore.getState().radar;
    if (
      !old ||
      old.id !== latest.id ||
      useTwinStore.getState().radarFeed.snapshot
    ) {
      latest.url = await imageDataURL(latest.url, signal);
      if (signal.aborted) return;
      useTwinStore.setState({ radar: latest });
    }
    if (!signal.aborted)
      update({
        loading: false,
        error: null,
        receivedAt: Date.now(),
        snapshot: false,
      });
  } catch (e) {
    if (signal.aborted) return;
    update({ loading: false, error: errorText(e) });
    if (!useTwinStore.getState().radar)
      try {
        const raw = (await getJSON(
          `${TWIN_DATA}radar-snapshot.json`,
          signal,
        )) as { id: number; dt: string; extent: number[] };
        const frame = parseRadar({
          id: raw.id,
          dt: raw.dt,
          name: "SRI",
          format: "image/png",
          details: { extent: raw.extent },
        });
        frame.url = `${TWIN_DATA}radar-snapshot.png`;
        if (!signal.aborted) {
          useTwinStore.setState({ radar: frame });
          update({ snapshot: true });
        }
      } catch {
        /* Keep source unavailable. */
      }
  }
}
export function TwinRuntime() {
  const active = useTwinStore((s) => s.active),
    auto = useTwinStore((s) => s.autoRefresh),
    key = useTwinStore((s) => s.refreshKey),
    radarOn = useTwinStore((s) => s.radarOn);
  useEffect(() => {
    if (active) return startPolling(sensors, auto);
  }, [active, auto, key]);
  useEffect(() => {
    if (active && radarOn) return startPolling(radar, auto);
  }, [active, auto, key, radarOn]);
  return null;
}
