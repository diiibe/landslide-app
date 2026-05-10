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
import { addRoads, ROADS_HALO, ROADS_LAYER, setRoadsVisible } from "./layers/roads";
import { addDtmHillshade, DTM_LAYER, setDtmHillshadeVisible } from "./layers/dtmHillshade";
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
 * Static layers — DTM hillshade source + roads source/lines — that depend on
 * theme but not model. Added once per `style.load`. Theme changes just
 * recolor them via `applyThemeToLayers` (no source teardown).
 */
function setupStaticLayers(m: maplibregl.Map): void {
  const s = useAppStore.getState();
  const dark = s.theme === "dark";
  addDtmHillshade(m, s.layers.dtm, dark);
  addRoads(m, s.layers.roads, dark);
}

/**
 * Recolor theme-dependent layers in place. Roads + DTM hillshade have a
 * dark and a light variant; switching shouldn't tear down sources because
 * MapLibre would re-fetch tiles and flash empty overlays (P1.2). Falls
 * back to a full re-add if a layer is missing (e.g. theme effect fired
 * before style.load completed).
 */
function applyThemeToLayers(m: maplibregl.Map): void {
  const s = useAppStore.getState();
  const dark = s.theme === "dark";
  if (m.getLayer(ROADS_LAYER) && m.getLayer(ROADS_HALO)) {
    const stroke = dark ? "#E2D2B6" : "#3A2F20";
    const halo = dark ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.7)";
    m.setPaintProperty(ROADS_LAYER, "line-color", stroke);
    m.setPaintProperty(ROADS_HALO, "line-color", halo);
  } else {
    addRoads(m, s.layers.roads, dark);
  }
  if (m.getLayer(DTM_LAYER)) {
    m.setPaintProperty(DTM_LAYER, "hillshade-highlight-color", dark ? "#E2C996" : "#FFF6DD");
    m.setPaintProperty(DTM_LAYER, "hillshade-shadow-color", dark ? "#0F0B05" : "#3F2914");
    m.setPaintProperty(DTM_LAYER, "hillshade-accent-color", dark ? "#7A6342" : "#A28856");
  } else {
    addDtmHillshade(m, s.layers.dtm, dark);
  }
}

/**
 * Model-dependent layers: susceptibility, smooth heatmap, IFFI overlay,
 * zone boundaries. Tearing down only these on a model switch keeps theme
 * + roads + DTM tiles in cache and avoids the "everything flashes empty"
 * artifact.
 *
 * Order matters: zone-boundaries shares the cells source with
 * susceptibility, so it must be removed BEFORE the source; on add it must
 * come AFTER the source exists.
 */
function setupModelLayers(m: maplibregl.Map): void {
  const s = useAppStore.getState();
  if (m.getLayer(ZONE_LINE)) m.removeLayer(ZONE_LINE);
  if (m.getLayer(SUSCEPT_LAYER)) m.removeLayer(SUSCEPT_LAYER);
  if (m.getSource(SUSCEPT_SOURCE)) m.removeSource(SUSCEPT_SOURCE);
  if (m.getLayer(HEAT_LAYER)) m.removeLayer(HEAT_LAYER);
  if (m.getSource(HEAT_SOURCE)) m.removeSource(HEAT_SOURCE);

  addSusceptibility(m, s.model, s.threshold, s.selectedZones);
  addSmoothHeatmap(m, s.model, s.threshold, s.layers.smoothHeatmap);
  addIffi(m, s.layers.iffi);
  addZoneBoundaries(m);
  setZoneBoundariesVisible(m, s.layers.zoneBoundaries);
  setSusceptibilityVisible(m, s.layers.susceptibility);
}

export function MapView() {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupsUnsubRef = useRef<(() => void) | null>(null);

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
    // Single style.load handler. Every basemap switch re-emits style.load
    // and re-creates layer ids, so we always re-register popups against
    // the new layer instances. We tear down the previous popup
    // subscription first (P1.1) — otherwise hover handlers from the old
    // style would dangle on a defunct map state.
    m.on("style.load", () => {
      setupStaticLayers(m);
      applyThemeToLayers(m);
      setupModelLayers(m);
      popupsUnsubRef.current?.();
      popupsUnsubRef.current = registerPopups(m);
    });
    mapRef.current = m;
    setMap(m);
    return () => {
      setMap(null);
      popupsUnsubRef.current?.();
      popupsUnsubRef.current = null;
      m.remove();
      mapRef.current = null;
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
    setupModelLayers(m);
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

  // Theme switch: only re-tune road & hillshade paint properties. No
  // teardown — the old version called setupDataLayers which removed every
  // source/layer, briefly flashing the map empty (P1.2).
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !m.isStyleLoaded()) return;
    applyThemeToLayers(m);
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
