import {
  AIR_ENDPOINTS,
  mergeAirObservations,
  preserveNewerSeries,
  validData,
} from "./observations";
import { useEffect } from "react";
import { useExperienceStore } from "../store";
import { useRegionalStore } from "@/regional/store";
import { AIR_BASE } from "./model";
import { adoptAirData, useAirStore } from "./store";
import type { AirContext, AirData, Measure, WorldCover } from "./types";
async function json<T>(url: string, signal: AbortSignal): Promise<T> {
  const child = new AbortController();
  let rejectAbort: (reason: Error) => void = () => {};
  const aborted = new Promise<never>((_, reject) => {
    rejectAbort = reject;
  });
  const cancel = () => {
    child.abort();
    rejectAbort(new DOMException("Richiesta annullata", "AbortError"));
  };
  const timeout = setTimeout(() => {
    child.abort();
    rejectAbort(new Error("Tempo di risposta della fonte scaduto (25 s)"));
  }, 25000);
  signal.addEventListener("abort", cancel, { once: true });
  if (signal.aborted) cancel();
  try {
    return await Promise.race([
      (async () => {
        const r = await fetch(url, { cache: "no-cache", signal: child.signal });
        if (!r.ok) throw Error(`Fonte non disponibile (${r.status})`);
        return (await r.json()) as T;
      })(),
      aborted,
    ]);
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener("abort", cancel);
  }
}
export function AirRuntime() {
  const active = useExperienceStore((s) => s.activeId),
    refresh = useAirStore((s) => s.refreshKey),
    regionalRefresh = useRegionalStore((s) => s.refreshKey);
  useEffect(() => {
    if (active === "air")
      useAirStore.setState({ controls: null, inspector: null });
  }, [active]);
  useEffect(() => {
    if (active !== "air") return;
    let generation = 0,
      disposed = false,
      timer: ReturnType<typeof setTimeout> | null = null,
      controller: AbortController | null = null;
    async function load() {
      if (disposed || document.hidden) return;
      const request = ++generation;
      controller?.abort();
      const current = new AbortController();
      controller = current;
      const signal = current.signal;
      useAirStore.setState({ loading: true });
      try {
        const result = await Promise.allSettled([
          json<AirData>(AIR_BASE + "data.json", signal),
          json<AirContext>(AIR_BASE + "context.json", signal),
          json<WorldCover>(AIR_BASE + "worldcover.json", signal),
        ]);
        if (signal.aborted || disposed || request !== generation) return;
        const [d, c, w] = result;
        let bundleError: string | null = null;
        if (d.status === "fulfilled") {
          try {
            adoptAirData(
              preserveNewerSeries(
                validData(d.value),
                useAirStore.getState().data,
              ),
            );
          } catch {
            bundleError =
              "Archivio aggiornato non valido: conservata l’ultima copia disponibile.";
          }
        } else
          bundleError =
            "Aggiornamento non riuscito: conservata l’ultima copia disponibile.";
        if (bundleError)
          useAirStore.setState({ loading: false, error: bundleError });
        if (
          c.status === "fulfilled" &&
          c.value &&
          c.value.industrialZones?.type === "FeatureCollection" &&
          c.value.commercialZones?.type === "FeatureCollection"
        )
          useAirStore.setState({ context: c.value, contextError: null });
        else
          useAirStore.setState({
            contextError:
              "Aggiornamento dei perimetri non riuscito: ultimo archivio conservato.",
          });
        if (
          w.status === "fulfilled" &&
          w.value &&
          Array.isArray(w.value.classes) &&
          w.value.classes.length > 0 &&
          Array.isArray(w.value.bounds) &&
          w.value.bounds.length === 4 &&
          w.value.bounds.every(Number.isFinite)
        )
          useAirStore.setState({ world: w.value, worldError: null });
        else
          useAirStore.setState({
            worldError: "Copertura del suolo non disponibile.",
          });
        const base = useAirStore.getState().data;
        if (!base) return;
        const start = new Date(Date.now() - 90 * 86400000)
          .toISOString()
          .slice(0, 10);
        const results = await Promise.allSettled(
          (Object.keys(AIR_ENDPOINTS) as Measure[]).map(async (measure) => {
            const { id } = AIR_ENDPOINTS[measure],
              query = new URLSearchParams({
                $where: `data_misura >= '${start}T00:00:00' AND ubicazione in (${base.stations.map((st) => "'" + st.name.replace(/'/g, "''") + "'").join(",")})`,
                $limit: "50000",
                $order: "data_misura,ubicazione",
              });
            const rows = await json<Record<string, unknown>[]>(
              `https://www.dati.friuliveneziagiulia.it/resource/${id}.json?${query}`,
              signal,
            );
            if (!Array.isArray(rows) || rows.length >= 50000)
              throw Error("Risposta osservativa incompleta");
            return { measure, rows };
          }),
        );
        if (signal.aborted || disposed || request !== generation) return;
        let stations = base.stations;
        const status = { ...base.sourceStatus },
          now = new Date().toISOString();
        for (let i = 0; i < results.length; i++) {
          const measure = (Object.keys(AIR_ENDPOINTS) as Measure[])[i]!,
            result = results[i]!;
          if (result.status === "fulfilled") {
            try {
              stations = mergeAirObservations(
                stations,
                measure,
                result.value.rows,
              );
              const latest =
                stations
                  .flatMap((s) => (s.series[measure] ?? []).map((r) => r.date))
                  .sort()
                  .at(-1) ?? null;
              status[measure] = {
                checkedAt: now,
                retrievedAt: now,
                error: null,
                cadence:
                  "Statistica giornaliera · controllo automatico ogni 5 minuti durante la consultazione",
                latestMeasurement: latest,
                validation:
                  "L’API non specifica il livello di validazione; valori insufficienti esclusi",
              };
            } catch (e) {
              status[measure] = {
                checkedAt: now,
                retrievedAt: status[measure]?.retrievedAt ?? null,
                error: String(e),
                cadence: "Giornaliera",
              };
            }
          } else
            status[measure] = {
              checkedAt: now,
              retrievedAt: status[measure]?.retrievedAt ?? null,
              error: "Fonte non raggiungibile: ultima serie conservata",
              cadence: "Giornaliera",
            };
        }
        adoptAirData({ ...base, stations, sourceStatus: status });
        if (bundleError) useAirStore.setState({ error: bundleError });
      } catch (e) {
        if (!disposed && request === generation && !document.hidden)
          useAirStore.setState({
            loading: false,
            error: signal.aborted
              ? "Tempo di aggiornamento scaduto: dati precedenti conservati."
              : String(e),
          });
      } finally {
        if (!disposed && request === generation) {
          useAirStore.setState({ loading: false });
          timer = setTimeout(() => {
            void load();
          }, 300000);
        }
      }
    }
    const resume = () => {
      if (!document.hidden) {
        if (timer) clearTimeout(timer);
        void load();
      } else {
        if (timer) clearTimeout(timer);
        controller?.abort();
        useAirStore.setState({ loading: false });
      }
    };
    void load();
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("online", resume);
    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("online", resume);
    };
  }, [active, refresh, regionalRefresh]);
  return null;
}
