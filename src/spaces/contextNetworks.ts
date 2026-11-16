import type { Map as MLMap, ExpressionSpecification } from "maplibre-gl";
import { useAppStore, type AppState } from "@/app/store";
import type { V2Layer } from "@/app/types";
import { v2ClassColor } from "@/map/layers/modelV2";
import { selectedClasses } from "@/lib/landslideClasses";
import { useExperienceStore } from "./store";
import type { SpaceId } from "./types";
/** The Space supplies the thematic interpretation; visible map layers alone
 * never colour shared context. Other Spaces currently keep a neutral network. */
export function networkMapping(a: Pick<AppState, "layers">, preferred: V2Layer, activeSpace: SpaceId | null): V2Layer | null {
  if (activeSpace !== "landslides") return null;
  if (a.layers.v2Bodies && a.layers.v2Diffuse) return preferred;
  return a.layers.v2Bodies ? "bodies" : a.layers.v2Diffuse ? "diffuse" : null;
}
/** Exact class colours, never a second interpolated risk scale. A hidden
 * class loses its thematic colour; geometry remains neutral context. */
export function networkColor(which: V2Layer | null, classes: number[], dark: boolean): string | ExpressionSpecification {
  const neutral = dark ? "#a5b4ba" : "#62716c";
  if (!which || !classes.length) return neutral;
  return ["match", ["get", which === "bodies" ? "b" : "d"], ...classes.flatMap(c => [c, v2ClassColor(c, 5)]), neutral] as unknown as ExpressionSpecification;
}
interface Manifest { networks: Record<"roads" | "trails", { tiles: string; tileSha: string }> }
export function mountContextNetworks(m: MLMap) {
  let ready = m.isStyleLoaded(), disposed = false, pending = false, manifest: Manifest | null = null;
  const sync = () => {
    if (disposed || !ready) return;
    const a = useAppStore.getState(), s = useExperienceStore.getState();
    if (!manifest && !pending && !s.contextError && (a.layers.roads || a.layers.trails || s.activeId === "landslides")) {
      pending = true;
      void fetch(`${import.meta.env.BASE_URL}data/spaces/manifest.json`, { cache: "no-cache" }).then(r => {
        if (!r.ok) throw new Error(`Reti di contesto non disponibili (${r.status}).`);
        return r.json() as Promise<Manifest>;
      }).then(value => {
        if (disposed) return;
        if (!value.networks?.roads?.tiles || !value.networks?.trails?.tiles) throw new Error("Indice delle reti non valido.");
        manifest = value; pending = false; sync();
      }).catch(error => { pending = false; if (!disposed) useExperienceStore.setState({ contextError: error instanceof Error ? error.message : "Reti non disponibili." }); });
    }
    if (!manifest) return;
    const which = networkMapping(a, s.analysisLayer, s.activeId);
    for (const name of ["trails", "roads"] as const) {
      const id = `space-context-${name}`, line = `${id}-line`, entry = manifest.networks[name];
      if (!m.getSource(id)) m.addSource(id, { type: "vector", url: `pmtiles://${import.meta.env.BASE_URL}tiles/${entry.tiles}?v=${entry.tileSha}` });
      const color = networkColor(which, which ? selectedClasses(a.susceptibilityStyle[which]) : [], a.theme === "dark");
      if (!m.getLayer(line)) m.addLayer({ id: line, type: "line", source: id, "source-layer": "network", layout: { "line-cap": "round", "line-join": "round" }, paint: {
        "line-color": color, "line-width": ["interpolate", ["linear"], ["zoom"], 7, name === "roads" ? 1 : .5, 14, name === "roads" ? 3 : 1.7], "line-opacity": 1,
        ...(name === "trails" ? { "line-dasharray": [3, 2] } : {}),
      } });
      m.setPaintProperty(line, "line-color", color);
      m.setLayoutProperty(line, "visibility", a.layers[name] ? "visible" : "none");
    }
    if (!s.contextReady) useExperienceStore.setState({ contextReady: true });
  };
  const loaded = () => { ready = true; sync(); }, loading = () => { ready = false; };
  m.on("style.load", loaded); m.on("styledataloading", loading);
  const app = useAppStore.subscribe(sync), space = useExperienceStore.subscribe(sync);
  sync();
  return () => {
    disposed = true; app(); space(); m.off("style.load", loaded); m.off("styledataloading", loading);
    if (ready) for (const name of ["roads", "trails"]) {
      const id = `space-context-${name}`; if (m.getLayer(`${id}-line`)) m.removeLayer(`${id}-line`); if (m.getSource(id)) m.removeSource(id);
    }
  };
}
