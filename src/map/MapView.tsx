import { useEffect, useRef } from "react";
import maplibregl, { type RequestParameters, type ResourceType } from "maplibre-gl";
import { useAppStore } from "@/app/store";
import type { ModelId } from "@/app/types";
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
import {
  addRoads,
  applyRoadSensitivity,
  rebakeRoads,
  setRoadsVisible,
} from "./layers/roads";
import {
  addTrails,
  applyTrailSensitivity,
  rebakeTrails,
  setTrailsVisible,
} from "./layers/trails";
import {
  addComuni,
  applyComuniModel,
  setComuniVisible,
} from "./layers/comuni";
import {
  addCriticalPoi,
  applyPoiModel,
  setCriticalVisible,
  setHutsVisible,
} from "./layers/criticalPoi";
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
 * Static layers — added once per `style.load` and not torn down by model
 * switches. Roads/trails/comuni/POI sit here because their data is loaded
 * lazily once per category and refreshed in place (rebakeRoads,
 * applyComuniModel, etc.) when the active model changes.
 *
 * DTM is theme-dependent; the others depend on theme only via halo
 * opacity (roads/trails). On theme change, applyThemeToLayers recolours
 * DTM in place and re-creates roads/trails so their halo opacity follows
 * the new mode.
 */
function setupStaticLayers(m: maplibregl.Map): void {
  const s = useAppStore.getState();
  const dark = s.theme === "dark";
  addDtmHillshade(m, s.layers.dtm, dark);
  addComuni(m, s.layers.comuni, dark);
  addTrails(m, s.layers.trails, dark);
  addRoads(m, s.layers.roads, dark);
  addCriticalPoi(m, s.layers.poiCritical, s.layers.poiHuts);
}

/**
 * Recolour theme-dependent layers in place. DTM has dark/light variants
 * that we update via setPaintProperty so MapLibre doesn't re-fetch tiles
 * (P1.2). Roads and trails encode halo opacity in their layer paint at
 * add time; we re-add them on theme change rather than poking individual
 * properties, since the cached GeoJSON keeps the rebuild cheap.
 *
 * Gated by `appliedTheme`: every `style.load` calls us right after
 * `setupStaticLayers` already added these. On the *initial* call after a
 * setup, the theme hasn't actually transitioned — there's no work to do,
 * and re-adding kicks off a redundant bake (P1.1). Track the last theme
 * we applied so we only re-add on genuine transitions.
 */
let appliedTheme: "dark" | "light" | null = null;

function applyThemeToLayers(m: maplibregl.Map): void {
  const s = useAppStore.getState();
  const dark = s.theme === "dark";
  if (m.getLayer(DTM_LAYER)) {
    m.setPaintProperty(DTM_LAYER, "hillshade-highlight-color", dark ? "#E2C996" : "#FFF6DD");
    m.setPaintProperty(DTM_LAYER, "hillshade-shadow-color", dark ? "#0F0B05" : "#3F2914");
    m.setPaintProperty(DTM_LAYER, "hillshade-accent-color", dark ? "#7A6342" : "#A28856");
  } else {
    addDtmHillshade(m, s.layers.dtm, dark);
  }
  // Re-add roads/trails/POI/comuni only when the theme has genuinely
  // changed. On the first call after `setupStaticLayers`, `appliedTheme`
  // is null and we adopt the current value without re-adding —
  // setupStaticLayers owns the initial add. P1.11 fix: previously both
  // functions re-added, double-baking every basemap switch. Comuni
  // outline color also varies by theme so it joins this gated re-add.
  if (appliedTheme !== null && appliedTheme !== s.theme) {
    addComuni(m, s.layers.comuni, dark);
    addTrails(m, s.layers.trails, dark);
    addRoads(m, s.layers.roads, dark);
    addCriticalPoi(m, s.layers.poiCritical, s.layers.poiHuts);
  }
  appliedTheme = s.theme;
}

/**
 * Model-dependent layers: susceptibility cells, smooth heatmap, IFFI
 * overlay, zone boundaries. Tearing down only these on a model switch
 * keeps theme + roads/trails/comuni/POI tiles in cache and avoids the
 * "everything flashes empty" artifact (P1.2).
 *
 * Order matters: zone-boundaries shares the cells source with
 * susceptibility, so it must be removed BEFORE the source; on add it
 * must come AFTER the source exists.
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
  addZoneBoundaries(m, s.layers.zoneBoundaries);
  setSusceptibilityVisible(m, s.layers.susceptibility);
}

// Trailing-edge debounce delay for the rebake effects. Slider drags emit
// param updates at ~60Hz; a 120ms quiet window collapses a burst into a
// single bake (P0.4 / P1.12).
const REBAKE_DEBOUNCE_MS = 120;

export function MapView() {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupsUnsubRef = useRef<(() => void) | null>(null);
  // P1.10 — `model` changes trigger both the model effect (which rebakes)
  // and the param effects (because the selectors return new values for
  // the new model). Track the last-seen model in a ref so the param
  // effects can skip the rebake when the change was caused by a model
  // switch — the model effect already handled it.
  const prevModelForRoads = useRef<ModelId | null>(null);
  const prevModelForTrails = useRef<ModelId | null>(null);

  const basemap = useAppStore((s) => s.basemap);
  const model = useAppStore((s) => s.model);
  const threshold = useAppStore((s) => s.threshold);
  const selectedZones = useAppStore((s) => s.selectedZones);
  const susceptOn = useAppStore((s) => s.layers.susceptibility);
  const iffiOn = useAppStore((s) => s.layers.iffi);
  const zoneBoundariesOn = useAppStore((s) => s.layers.zoneBoundaries);
  const heatOn = useAppStore((s) => s.layers.smoothHeatmap);
  const roadsOn = useAppStore((s) => s.layers.roads);
  const trailsOn = useAppStore((s) => s.layers.trails);
  const comuniOn = useAppStore((s) => s.layers.comuni);
  const poiCriticalOn = useAppStore((s) => s.layers.poiCritical);
  const poiHutsOn = useAppStore((s) => s.layers.poiHuts);
  const sensRoads = useAppStore((s) => s.riskParams.roads[s.model].sensitivity);
  const sensTrails = useAppStore((s) => s.riskParams.trails[s.model].sensitivity);
  const gammaRoads = useAppStore((s) => s.riskParams.roads[s.model].gamma);
  const gammaTrails = useAppStore((s) => s.riskParams.trails[s.model].gamma);
  const radiusRoads = useAppStore((s) => s.riskParams.roads[s.model].radius);
  const radiusTrails = useAppStore((s) => s.riskParams.trails[s.model].radius);
  const dtmOn = useAppStore((s) => s.layers.dtm);
  const theme = useAppStore((s) => s.theme);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    installPmtilesProtocol();
    const m = new maplibregl.Map({
      container: ref.current,
      style: BASEMAP_STYLE[basemap],
      center: FVG_CENTER,
      zoom: 10,
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

  // Model change: rebuild only the susceptibility/heatmap/IFFI/zone-boundaries
  // stack, then refresh the in-place data on roads/trails/comuni/POI.
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !m.isStyleLoaded()) return;
    setupModelLayers(m);
    if (useAppStore.getState().layers.roads) rebakeRoads(m);
    if (useAppStore.getState().layers.trails) rebakeTrails(m);
    if (useAppStore.getState().layers.comuni) applyComuniModel(m);
    const ls = useAppStore.getState().layers;
    if (ls.poiCritical || ls.poiHuts) applyPoiModel(m);
    // Keep the param-effect refs in sync so a model switch followed by a
    // param change doesn't double-bake. The param effects compare their
    // own ref to the live model; setting both here means a later effect
    // ordering still sees prev === current and skips. (P1.10)
    prevModelForRoads.current = model;
    prevModelForTrails.current = model;
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
    if (mapRef.current) setTrailsVisible(mapRef.current, trailsOn);
  }, [trailsOn]);

  useEffect(() => {
    if (mapRef.current) setComuniVisible(mapRef.current, comuniOn);
  }, [comuniOn]);
  useEffect(() => {
    if (mapRef.current) setCriticalVisible(mapRef.current, poiCriticalOn);
  }, [poiCriticalOn]);
  useEffect(() => {
    if (mapRef.current) setHutsVisible(mapRef.current, poiHutsOn);
  }, [poiHutsOn]);

  // Sensitivity (paint-only) vs gamma/radius (re-bake). Each network is
  // wired independently so changing trails params doesn't touch roads.
  useEffect(() => {
    if (mapRef.current && roadsOn) applyRoadSensitivity(mapRef.current);
  }, [sensRoads, roadsOn]);
  useEffect(() => {
    if (mapRef.current && trailsOn) applyTrailSensitivity(mapRef.current);
  }, [sensTrails, trailsOn]);
  // P0.4 / P1.12 — slider drags fire ~60 events/sec; without a debounce
  // each event kicks off a full ~290M-op rebake. Schedule a trailing-edge
  // rebake; clearing on every new event coalesces a burst into one bake.
  //
  // P1.10 — a `model` change re-runs these effects (selectors return new
  // values for the new model) AND the model effect, which already
  // rebakes. Skip the rebake when the change was caused by a model
  // switch: the model effect owns the rebake in that case.
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !roadsOn) return;
    const currentModel = useAppStore.getState().model;
    if (prevModelForRoads.current !== currentModel) {
      prevModelForRoads.current = currentModel;
      return; // model effect handles the rebake
    }
    const id = setTimeout(() => rebakeRoads(m), REBAKE_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [gammaRoads, radiusRoads, roadsOn]);
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !trailsOn) return;
    const currentModel = useAppStore.getState().model;
    if (prevModelForTrails.current !== currentModel) {
      prevModelForTrails.current = currentModel;
      return; // model effect handles the rebake
    }
    const id = setTimeout(() => rebakeTrails(m), REBAKE_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [gammaTrails, radiusTrails, trailsOn]);

  useEffect(() => {
    if (mapRef.current) setDtmHillshadeVisible(mapRef.current, dtmOn);
  }, [dtmOn]);

  // Theme switch: in-place DTM recolour + re-create roads/trails/POI so
  // their theme-dependent halo opacity follows the new mode. No teardown
  // of model-driven layers — the old version called setupDataLayers which
  // removed every source/layer, briefly flashing the map empty (P1.2).
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !m.isStyleLoaded()) return;
    applyThemeToLayers(m);
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
