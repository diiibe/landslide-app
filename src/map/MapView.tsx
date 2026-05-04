import { useEffect, useRef } from "react";
import maplibregl, { type RequestParameters, type ResourceType } from "maplibre-gl";
import { useAppStore } from "@/app/store";
import { BASEMAP_STYLE, FVG_BOUNDS, FVG_CENTER } from "./style";
import { installPmtilesProtocol } from "./pmtiles-protocol";
import {
  addSusceptibility,
  setSusceptibilityVisible,
  SUSCEPT_LAYER,
  SUSCEPT_SOURCE,
  updateSusceptibilityThreshold,
  updateSusceptibilityZones,
} from "./layers/susceptibility";
import { addIffi, setIffiVisible } from "./layers/iffi";
import { addZoneBoundaries, setZoneBoundariesVisible, ZONE_LINE } from "./layers/zones";
import {
  addSmoothHeatmap,
  HEAT_LAYER,
  HEAT_SOURCE,
  setSmoothHeatmapVisible,
  updateSmoothHeatmapThreshold,
} from "./layers/smoothHeatmap";
import { addRoads, ROADS_HALO, ROADS_LAYER, ROADS_SOURCE, setRoadsVisible } from "./layers/roads";
import { addDtmHillshade, DEM_SOURCE, DTM_LAYER, setDtmHillshadeVisible } from "./layers/dtmHillshade";
import { registerPopups } from "./popups";
import { setMap } from "./instance";
import styles from "./MapView.module.css";

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;

function rewriteMapboxUrl(url: string, resourceType: ResourceType | undefined): RequestParameters {
  if (!url.startsWith("mapbox://") || !TOKEN) return { url };
  const tail = url.slice("mapbox://".length);
  const sep = (u: string) => (u.includes("?") ? "&" : "?") + `access_token=${TOKEN}`;
  let target: string;
  if (tail.startsWith("sprites/")) {
    const m = tail.match(/^sprites\/([^?]+?)(@\dx)?(\.\w+)?(\?.*)?$/);
    if (!m) return { url };
    const [, path, ratio = "", ext = "", query = ""] = m;
    target = `https://api.mapbox.com/styles/v1/${path}/sprite${ratio}${ext}${query}`;
  } else if (tail.startsWith("fonts/")) {
    target = `https://api.mapbox.com/${tail}`;
  } else if (
    resourceType === "Source" ||
    /^[a-z0-9._-]+(\.[a-z0-9._-]+)*(,[a-z0-9._-]+)*(\?|$)/i.test(tail)
  ) {
    const [path, query = ""] = tail.split("?", 2);
    target = `https://api.mapbox.com/v4/${path}.json?secure${query ? "&" + query : ""}`;
  } else if (tail.startsWith("tiles/")) {
    target = `https://api.mapbox.com/v4/${tail.slice("tiles/".length)}`;
  } else {
    target = `https://api.mapbox.com/v4/${tail}`;
  }
  return { url: target + sep(target) };
}

/**
 * Tear down and rebuild data layers atomically. Order matters:
 * 1. Remove dependent layers first (`zone-boundaries` references the cells
 *    source — if we remove the source first, MapLibre throws.)
 * 2. Remove susceptibility layer.
 * 3. Remove the cells source.
 * 4. Re-add source + susceptibility + zone-boundaries (in that dep order).
 * 5. Re-add IFFI (independent — only added once if missing).
 */
function setupDataLayers(m: maplibregl.Map): void {
  const s = useAppStore.getState();
  const dark = s.theme === "dark";
  // 1. teardown layers that hold sources we are about to swap
  if (m.getLayer(ZONE_LINE)) m.removeLayer(ZONE_LINE);
  if (m.getLayer(SUSCEPT_LAYER)) m.removeLayer(SUSCEPT_LAYER);
  if (m.getSource(SUSCEPT_SOURCE)) m.removeSource(SUSCEPT_SOURCE);
  if (m.getLayer(HEAT_LAYER)) m.removeLayer(HEAT_LAYER);
  if (m.getSource(HEAT_SOURCE)) m.removeSource(HEAT_SOURCE);
  if (m.getLayer(ROADS_LAYER)) m.removeLayer(ROADS_LAYER);
  if (m.getLayer(ROADS_HALO)) m.removeLayer(ROADS_HALO);
  if (m.getSource(ROADS_SOURCE)) m.removeSource(ROADS_SOURCE);
  if (m.getLayer(DTM_LAYER)) m.removeLayer(DTM_LAYER);
  if (m.getSource(DEM_SOURCE)) m.removeSource(DEM_SOURCE);
  // 2. rebuild — order from "background" to "foreground"
  addDtmHillshade(m, s.layers.dtm, dark);                          // bottom: terrain shading
  addSusceptibility(m, s.model, s.threshold, s.selectedZones);     // colored cells
  addSmoothHeatmap(m, s.model, s.threshold, s.layers.smoothHeatmap); // KDE glow
  addIffi(m, s.layers.iffi);                                       // ground truth polygons
  addZoneBoundaries(m);                                            // zone outlines
  setZoneBoundariesVisible(m, s.layers.zoneBoundaries);
  setSusceptibilityVisible(m, s.layers.susceptibility);
  addRoads(m, s.layers.roads, dark);                               // top: road overlay
}

export function MapView() {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupsRegistered = useRef(false);

  const basemap = useAppStore((s) => s.basemap);
  const model = useAppStore((s) => s.model);
  const threshold = useAppStore((s) => s.threshold);
  const selectedZones = useAppStore((s) => s.selectedZones);
  const susceptOn = useAppStore((s) => s.layers.susceptibility);
  const iffiOn = useAppStore((s) => s.layers.iffi);
  const zoneBoundariesOn = useAppStore((s) => s.layers.zoneBoundaries);
  const heatOn = useAppStore((s) => s.layers.smoothHeatmap);
  const roadsOn = useAppStore((s) => s.layers.roads);
  const dtmOn = useAppStore((s) => s.layers.dtm);
  const theme = useAppStore((s) => s.theme);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    installPmtilesProtocol();
    const m = new maplibregl.Map({
      container: ref.current,
      style: BASEMAP_STYLE[basemap],
      center: FVG_CENTER,
      zoom: 8,
      maxBounds: [
        [FVG_BOUNDS[0][0] - 0.5, FVG_BOUNDS[0][1] - 0.5],
        [FVG_BOUNDS[1][0] + 0.5, FVG_BOUNDS[1][1] + 0.5],
      ],
      validateStyle: false,
      transformRequest: rewriteMapboxUrl,
    });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    m.on("style.load", () => {
      setupDataLayers(m);
      if (!popupsRegistered.current) {
        registerPopups(m);
        popupsRegistered.current = true;
      }
    });
    mapRef.current = m;
    setMap(m);
    return () => {
      setMap(null);
      m.remove();
      mapRef.current = null;
      popupsRegistered.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    m.setStyle(BASEMAP_STYLE[basemap]);
  }, [basemap]);

  useEffect(() => {
    const m = mapRef.current;
    if (!m || !m.isStyleLoaded()) return;
    setupDataLayers(m);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model]);

  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    updateSusceptibilityThreshold(m, threshold);
    updateSmoothHeatmapThreshold(m, threshold);
  }, [threshold]);

  useEffect(() => {
    if (mapRef.current) updateSusceptibilityZones(mapRef.current, selectedZones);
  }, [selectedZones]);

  useEffect(() => {
    if (mapRef.current) setSusceptibilityVisible(mapRef.current, susceptOn);
  }, [susceptOn]);

  useEffect(() => {
    if (mapRef.current) setIffiVisible(mapRef.current, iffiOn);
  }, [iffiOn]);

  useEffect(() => {
    if (mapRef.current) setZoneBoundariesVisible(mapRef.current, zoneBoundariesOn);
  }, [zoneBoundariesOn]);

  useEffect(() => {
    if (mapRef.current) setSmoothHeatmapVisible(mapRef.current, heatOn);
  }, [heatOn]);

  useEffect(() => {
    if (mapRef.current) setRoadsVisible(mapRef.current, roadsOn);
  }, [roadsOn]);

  useEffect(() => {
    if (mapRef.current) setDtmHillshadeVisible(mapRef.current, dtmOn);
  }, [dtmOn]);

  // Theme switch: re-tune road & hillshade colors that depend on dark/light.
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !m.isStyleLoaded()) return;
    setupDataLayers(m);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  useEffect(() => {
    const onFly = (e: Event) => {
      const d = (e as CustomEvent<{ lng: number; lat: number }>).detail;
      mapRef.current?.flyTo({ center: [d.lng, d.lat], zoom: 11, essential: true });
    };
    window.addEventListener("fvg:flyto", onFly);
    return () => window.removeEventListener("fvg:flyto", onFly);
  }, []);

  return <div ref={ref} className={styles.root} aria-label="FVG susceptibility map" />;
}
