import { useEffect } from "react";
import { getJSON } from "@/digital-twin/data";
import { useTwinStore } from "@/digital-twin/store";
import { startPolling } from "@/digital-twin/polling";
import { erddapData, validateGeoJSON, pcrProductData } from "./data";
import { layerURL, parseCatalog, patchEntry, useRegionalStore } from "./store";
import type { LayerDefinition } from "./types";
export function RegionalRuntime() {
  const catalog = useRegionalStore((s) => s.catalog),
    enabled = useRegionalStore((s) => s.enabled),
    key = useRegionalStore((s) => s.refreshKey);
  const measures = useTwinStore((s) => s.measures),
    sensorsFeed = useTwinStore((s) => s.sensorsFeed);
  useEffect(() => {
    let controller: AbortController | null = null;
    let stopped = false;
    const load = async () => {
      if (document.hidden) return;
      controller?.abort();
      controller = new AbortController();
      const ac = controller;
      try {
        const raw = await getJSON(
          layerURL("catalog.json") + "?v=" + Math.floor(Date.now() / 300000),
          ac.signal,
        );
        if (stopped) return;
        const c = parseCatalog(raw);
        if (useRegionalStore.getState().catalog?.generatedAt !== c.generatedAt)
          useRegionalStore.setState({ catalog: c });
        useRegionalStore.setState({ catalogError: null });
      } catch (e) {
        if (!ac.signal.aborted)
          useRegionalStore.setState({
            catalogError:
              e instanceof Error ? e.message : "Catalogo non disponibile",
          });
      }
    };
    void load();
    const timer = setInterval(() => void load(), 300000);
    document.addEventListener("visibilitychange", load);
    window.addEventListener("online", load);
    return () => {
      stopped = true;
      controller?.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", load);
      window.removeEventListener("online", load);
    };
  }, [key]);
  useEffect(() => {
    useTwinStore.setState({
      active: true,
      radarOn: !!enabled["pcr-radar"],
      buildingsOn: !!enabled["twin-buildings"],
      assetsOn: !!enabled["twin-aia"],
    });
  }, [enabled]);
  useEffect(() => {
    for (const l of catalog?.layers ?? []) {
      if (l.liveKind !== "pcr" || !enabled[l.id]) continue;
      const rows = measures.filter((m) => m.sensorId === l.pcrSensorId);
      const data = {
        type: "FeatureCollection" as const,
        features: rows.map((m) => ({
          type: "Feature" as const,
          id: String(m.stationId),
          geometry: { type: "Point" as const, coordinates: [m.lon, m.lat] },
          properties: {
            __featureId: String(m.stationId),
            __name: m.name,
            __value: m.value,
            __displayValue: String(m.value),
            __unit: l.metric?.unit ?? "",
            __observedAt: new Date(m.ms).toISOString(),
            __invalidTime: m.ms > Date.now() + 300000,
            stationId: m.stationId,
            sensorId: m.sensorId,
          },
        })),
      };
      patchEntry(l.id, {
        data,
        loading: sensorsFeed.loading,
        error: sensorsFeed.error,
        snapshot: sensorsFeed.snapshot,
        ...(sensorsFeed.receivedAt
          ? { receivedAt: sensorsFeed.receivedAt }
          : {}),
      });
    }
  }, [catalog, enabled, measures, sensorsFeed]);
  useEffect(() => {
    if (!catalog) return;
    const tasks = catalog.layers.filter(
      (l) =>
        enabled[l.id] &&
        l.status === "ready" &&
        l.kind === "geojson" &&
        l.liveKind !== "pcr",
    );
    if (!tasks.length) return;
    const load = async (signal: AbortSignal) => {
      const rawCache = new Map<string, Promise<unknown>>();
      let cursor = 0;
      const raw = (url: string) => {
        if (!rawCache.has(url)) rawCache.set(url, getJSON(url, signal));
        return rawCache.get(url)!;
      };
      const one = async (l: LayerDefinition) => {
        const version = l.file + ":" + l.retrievedAt,
          entry = useRegionalStore.getState().entries[l.id];
        if (
          !l.live &&
          !l.pollUrl &&
          entry?.data &&
          entry.sourceVersion === version &&
          entry.refreshKey === key
        )
          return;
        patchEntry(l.id, { loading: true });
        try {
          let data;
          if (l.live?.length) {
            const chunks = await Promise.all(
              l.live.map(async (src) =>
                erddapData(await raw(src.url), src.parameter, src),
              ),
            );
            data = {
              type: "FeatureCollection" as const,
              features: chunks.flatMap((c) => c.features),
            };
            if (!data.features.length)
              throw Error(
                "Nessuna misura osservata disponibile nella finestra della fonte",
              );
          } else if (
            l.pollUrl &&
            (l.liveKind === "earthquakes" || l.liveKind === "webcams")
          )
            data = pcrProductData(await raw(l.pollUrl), l.liveKind);
          else {
            if (!l.file) throw Error("File dati non definito");
            data = validateGeoJSON(
              await raw(
                layerURL(l.file) +
                  "?v=" +
                  encodeURIComponent(l.retrievedAt ?? ""),
              ),
            );
          }
          if (signal.aborted) return;
          patchEntry(l.id, {
            data,
            sourceVersion: version,
            refreshKey: key,
            loading: false,
            error: null,
            receivedAt: Date.now(),
            snapshot: !l.live && !l.pollUrl,
          });
        } catch (e) {
          if (signal.aborted) return;
          patchEntry(l.id, {
            loading: false,
            error: e instanceof Error ? e.message : "Fonte non disponibile",
          });
          if (!useRegionalStore.getState().entries[l.id]?.data && l.file) {
            try {
              const data = validateGeoJSON(
                await raw(
                  layerURL(l.file) +
                    "?v=" +
                    encodeURIComponent(l.retrievedAt ?? ""),
                ),
              );
              if (!signal.aborted) patchEntry(l.id, { data, snapshot: true });
            } catch {
              /* The source error remains visible. */
            }
          }
        }
      };
      await Promise.all(
        Array.from({ length: Math.min(4, tasks.length) }, async () => {
          while (cursor < tasks.length && !signal.aborted) {
            const l = tasks[cursor++]!;
            await one(l);
          }
        }),
      );
    };
    return startPolling(load, true);
  }, [catalog, enabled, key]);
  return null;
}
