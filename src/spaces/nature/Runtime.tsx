import { useEffect } from "react";
import { useExperienceStore } from "../store";
import { useRegionalStore } from "@/regional/store";
import { FIRE_DAYS } from "./fire";
import { useNatureStore, type TreeFeature } from "./store";
export function NatureRuntime() {
  const active = useExperienceStore((s) => s.activeId),
    playing = useNatureStore((s) => s.firePlaying);
  const catalog = useRegionalStore((s) => s.catalog),
    refresh = useRegionalStore((s) => s.refreshKey);
  const entry = catalog?.layers.find((l) => l.id === "open-uqpq-dr8x");
  const treeFile = entry?.file ?? "open-uqpq-dr8x.geojson",
    version = entry?.retrievedAt;
  useEffect(() => {
    if (active !== "fire") return;
    const controller = new AbortController();
    void fetch(
      `${import.meta.env.BASE_URL}data/spaces/nature/fire-perimeters.geojson`,
      { cache: "no-cache", signal: controller.signal },
    )
      .then(async (r) => {
        if (!r.ok)
          throw new Error(`Perimetri EFFIS non disponibili (${r.status})`);
        const d = (await r.json()) as GeoJSON.FeatureCollection;
        if (
          d.type !== "FeatureCollection" ||
          !Array.isArray(d.features) ||
          d.features.some(
            (f) => !["Polygon", "MultiPolygon"].includes(f.geometry?.type),
          )
        )
          throw new Error("Archivio EFFIS non valido");
        if (controller.signal.aborted) return;
        const provenance = (
          d as GeoJSON.FeatureCollection & {
            provenance?: { refreshError?: string };
          }
        ).provenance;
        useNatureStore.setState({
          fireData: d,
          fireError: provenance?.refreshError
            ? `Aggiornamento EFFIS non riuscito: ${provenance.refreshError}`
            : null,
        });
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          useNatureStore.setState({ fireError: String(e) });
      });
    return () => controller.abort();
  }, [active, refresh, catalog?.generatedAt]);
  useEffect(() => {
    if (active !== "park") return;
    const c = new AbortController();
    useNatureStore.setState({ treeLoading: true });
    void fetch(`${import.meta.env.BASE_URL}data/regional/${treeFile}`, {
      cache: "no-cache",
      signal: c.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`Censimento non disponibile (${r.status})`);
        const d = (await r.json()) as GeoJSON.FeatureCollection;
        if (d.type !== "FeatureCollection" || !Array.isArray(d.features))
          throw new Error("Censimento non valido");
        const trees = d.features.filter(
          (f): f is TreeFeature =>
            f.geometry?.type === "Point" &&
            f.geometry.coordinates.length >= 2 &&
            f.geometry.coordinates.slice(0, 2).every(Number.isFinite),
        );
        if (!trees.length)
          throw new Error("Il censimento non contiene posizioni utilizzabili");
        if (c.signal.aborted) return;
        useNatureStore.setState({
          trees,
          treeLoading: false,
          treeError: null,
          treeRetrieved: version ?? null,
          treeInputRows: entry?.inputRows ?? 1242,
        });
      })
      .catch((e) => {
        if (!c.signal.aborted)
          useNatureStore.setState({ treeLoading: false, treeError: String(e) });
      });
    return () => c.abort();
  }, [active, treeFile, version, refresh, entry?.inputRows]);
  useEffect(() => {
    if (active !== "fire" || !playing) return;
    const tick = setInterval(() => {
      if (document.visibilityState === "hidden") return;
      const index = useNatureStore.getState().fireDay;
      if (index >= FIRE_DAYS.length - 1)
        useNatureStore.setState({ firePlaying: false });
      else useNatureStore.setState({ fireDay: index + 1 });
    }, 1800);
    return () => clearInterval(tick);
  }, [active, playing]);
  useEffect(() => {
    if (active !== "fire") useNatureStore.setState({ firePlaying: false });
  }, [active]);
  return null;
}
