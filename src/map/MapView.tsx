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
import { addIffi, IFFI_FILL, IFFI_LINE, setIffiVisible } from "./layers/iffi";
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
  ROADS_GLOW,
  ROADS_HALO,
  ROADS_LAYER,
  setRoadsVisible,
} from "./layers/roads";
import {
  addTrails,
  applyTrailSensitivity,
  rebakeTrails,
  setTrailsVisible,
  TRAILS_GLOW,
  TRAILS_HALO,
  TRAILS_LAYER,
} from "./layers/trails";
import {
  addComuni,
  applyComuniFilter,
  applyComuniModel,
  setComuniVisible,
} from "./layers/comuni";
import {
  addCriticalPoi,
  applyPoiCategoryFilter,
  applyPoiColors,
  applyPoiModel,
  setCriticalVisible,
  setHutsVisible,
} from "./layers/criticalPoi";
import { addDtmHillshade, DTM_LAYER, setDtmHillshadeVisible } from "./layers/dtmHillshade";
import {
  addFloodOverlay,
  removeFloodOverlay,
  setFloodOpacity,
  setFloodView,
  setFloodVisible,
} from "./layers/floodSusceptibility";
import {
  addPaiOverlay,
  removePaiOverlay,
  setPaiOpacity,
  setPaiVisible,
} from "./layers/paiOverlay";
import {
  addDiffOverlay,
  removeDiffOverlay,
  setDiffOpacity,
  setDiffVisible,
} from "./layers/diffOverlay";
import {
  addUserLayer,
  applyUserLayer,
  bringUserLayerToFront,
  removeUserLayer,
} from "./layers/userLayer";
import { bakeUserLayerRisk } from "./layers/userLayerHeatmap";
import {
  bringUserPolygonsToFront,
  openPolygonPopup,
  registerPolygonClicks,
  setupUserPolygons,
  updateUserPolygonsData,
} from "./layers/userPolygons";
import { startDrawing, stopDrawing } from "./drawing";
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
/**
 * Bottom-most network layer currently in the style, in priority order
 * (lowest z first). The road/trail/POI network should always sit on top
 * of model data (cells + heatmap + IFFI + comuni choropleth) so the
 * route context stays readable when a comune is highlighted. We collect
 * the layer ids in the order they were added by `setupStaticLayers`
 * (trails before roads) and return the first one still present.
 */
function networkAnchor(m: maplibregl.Map): string | undefined {
  const candidates = [
    TRAILS_GLOW,
    TRAILS_HALO,
    TRAILS_LAYER,
    ROADS_GLOW,
    ROADS_HALO,
    ROADS_LAYER,
  ];
  return candidates.find((id) => m.getLayer(id));
}

function setupModelLayers(m: maplibregl.Map): void {
  const s = useAppStore.getState();
  if (m.getLayer(ZONE_LINE)) m.removeLayer(ZONE_LINE);
  if (m.getLayer(SUSCEPT_LAYER)) m.removeLayer(SUSCEPT_LAYER);
  if (m.getSource(SUSCEPT_SOURCE)) m.removeSource(SUSCEPT_SOURCE);
  if (m.getLayer(HEAT_LAYER)) m.removeLayer(HEAT_LAYER);
  if (m.getSource(HEAT_SOURCE)) m.removeSource(HEAT_SOURCE);

  addSusceptibility(m, s.model, s.threshold, s.selectedZones);
  addSmoothHeatmap(m, s.model, s.threshold, s.layers.smoothHeatmap);
  if (s.layers.flood) {
    addFloodOverlay(m, s.floodView, s.floodOpacity);
  } else {
    removeFloodOverlay(m);
  }
  if (s.layers.pai) {
    addPaiOverlay(m, s.paiOpacity);
  } else {
    removePaiOverlay(m);
  }
  if (s.layers.diff) {
    addDiffOverlay(m, s.diffOpacity);
  } else {
    removeDiffOverlay(m);
  }
  addIffi(m, s.layers.iffi);
  addZoneBoundaries(m, s.layers.zoneBoundaries);
  setSusceptibilityVisible(m, s.layers.susceptibility);

  // Keep the network on top of the model data so roads + trails remain
  // visible across the comune choropleth (and any other coloured fill
  // below them). MapLibre's `addLayer` puts new layers on top by
  // default; we move the freshly-added model layers below the network
  // anchor (the bottom-most trail/road layer) after the fact.
  const anchor = networkAnchor(m);
  if (anchor) {
    for (const id of [SUSCEPT_LAYER, HEAT_LAYER, IFFI_FILL, IFFI_LINE, ZONE_LINE]) {
      if (m.getLayer(id)) m.moveLayer(id, anchor);
    }
  }
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
  const floodOn = useAppStore((s) => s.layers.flood);
  const floodView = useAppStore((s) => s.floodView);
  const floodOpacityVal = useAppStore((s) => s.floodOpacity);
  const paiOn = useAppStore((s) => s.layers.pai);
  const paiOpacityVal = useAppStore((s) => s.paiOpacity);
  const diffOn = useAppStore((s) => s.layers.diff);
  const diffOpacityVal = useAppStore((s) => s.diffOpacity);
  const theme = useAppStore((s) => s.theme);
  const selectedComuni = useAppStore((s) => s.selectedComuni);
  const userLayers = useAppStore((s) => s.userLayers);
  const userPolygons = useAppStore((s) => s.userPolygons);
  const drawingMode = useAppStore((s) => s.drawingMode);
  const poiColors = useAppStore((s) => s.poiColors);
  const poiCategoryVisible = useAppStore((s) => s.poiCategoryVisible);

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
      // Re-add user uploads after a basemap swap wiped the style. The
      // userLayers effect would catch this too, but firing here keeps
      // the layers visible without a one-frame gap.
      for (const layer of useAppStore.getState().userLayers) {
        addUserLayer(m, layer);
      }
      setupUserPolygons(m, useAppStore.getState().userPolygons);
      popupsUnsubRef.current?.();
      const popupsUnsub = registerPopups(m);
      const polygonUnsub = registerPolygonClicks(m, () =>
        useAppStore.getState().userPolygons,
      );
      popupsUnsubRef.current = () => {
        popupsUnsub();
        polygonUnsub();
      };
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
    if (ls.poiCritical || ls.poiHuts) applyPoiModel();
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
    updateSusceptibilityThreshold(m, threshold, selectedZones);
    updateSmoothHeatmapThreshold(m, threshold);
  }, [threshold, selectedZones]);

  useEffect(() => {
    if (mapRef.current) {
      updateSusceptibilityZones(mapRef.current, threshold, selectedZones);
    }
  }, [selectedZones, threshold]);

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

  // Flood overlay: master toggle adds/removes the layer; view changes
  // re-create the raster source (tile URL is baked in at source-add);
  // opacity changes are a cheap paint mutation.
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    if (floodOn) {
      addFloodOverlay(m, floodView, floodOpacityVal);
      setFloodVisible(m, true);
    } else {
      removeFloodOverlay(m);
    }
  }, [floodOn]);
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !floodOn) return;
    setFloodView(m, floodView);
  }, [floodView, floodOn]);
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !floodOn) return;
    setFloodOpacity(m, floodOpacityVal);
  }, [floodOpacityVal, floodOn]);

  // PAI ground-truth overlay
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    if (paiOn) {
      addPaiOverlay(m, paiOpacityVal);
      setPaiVisible(m, true);
    } else {
      removePaiOverlay(m);
    }
  }, [paiOn]);
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !paiOn) return;
    setPaiOpacity(m, paiOpacityVal);
  }, [paiOpacityVal, paiOn]);

  // Model-vs-PAI difference overlay
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    if (diffOn) {
      addDiffOverlay(m, diffOpacityVal);
      setDiffVisible(m, true);
    } else {
      removeDiffOverlay(m);
    }
  }, [diffOn]);
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !diffOn) return;
    setDiffOpacity(m, diffOpacityVal);
  }, [diffOpacityVal, diffOn]);

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

  // fitBounds dispatch (e.g. from ComuneFilterPanel). The detail carries
  // a [[w,s],[e,n]] bbox plus an optional padding override.
  useEffect(() => {
    const onFit = (e: Event) => {
      const d = (e as CustomEvent<{
        bounds: [[number, number], [number, number]];
        padding?: number;
      }>).detail;
      mapRef.current?.fitBounds(d.bounds, {
        padding: d.padding ?? 64,
        duration: 600,
        essential: true,
      });
    };
    window.addEventListener("fvg:fitbounds", onFit);
    return () => window.removeEventListener("fvg:fitbounds", onFit);
  }, []);

  // Reactive comune filter — pushes the current selection into MapLibre's
  // filter expression. Runs whenever the selection array reference changes
  // OR the layer is freshly added (comuniOn flip from off→on adds the
  // layer; applyComuniFilter inside addComuni already covers that path,
  // but we re-run here too in case selection changed while the layer was
  // hidden).
  useEffect(() => {
    if (mapRef.current && comuniOn) {
      applyComuniFilter(mapRef.current, selectedComuni);
    }
  }, [selectedComuni, comuniOn]);

  // User-uploaded layers — reconcile the store array against the map's
  // current set: remove gone-ids, add new-ids (also after a style swap
  // that wiped them), apply paint/visibility tweaks on every change.
  // Always end with the user layers on top of every model and network
  // layer so uploads stay visible regardless of underlying data.
  const prevUserIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    const m = mapRef.current;
    // Don't gate on `isStyleLoaded()`: that returns false whenever any
    // source still has pending tiles, which happens routinely after the
    // initial style.load (tiles fetch asynchronously) and on every
    // basemap swap. Bailing here meant the GPX never got mounted —
    // addUserLayer is safe to call against a created map even mid-load.
    if (!m || !m.getStyle()) return;
    const seen = new Set<string>();
    for (const layer of userLayers) {
      seen.add(layer.id);
      const sourceId = `user-src-${layer.id}`;
      if (!m.getSource(sourceId)) {
        addUserLayer(m, layer);
      } else {
        applyUserLayer(m, layer);
      }
      bringUserLayerToFront(m, layer.id);
    }
    for (const oldId of prevUserIds.current) {
      if (!seen.has(oldId)) removeUserLayer(m, oldId);
    }
    prevUserIds.current = seen;
    // bringUserLayerToFront above promoted every GPX glow/halo/stroke to
    // the top of the style — which buries the polygon outline (line-width
    // 2.5) under a 14-20px line-blur glow. Re-promote polygons so the
    // outline stays visible regardless of how user layers move.
    bringUserPolygonsToFront(m);
  }, [userLayers]);

  // Reactive POI palette — push the user-edited category colours into
  // every live POI tier's `circle-color` whenever the store map changes.
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !m.getStyle()) return;
    applyPoiColors(m);
  }, [poiColors]);

  // Reactive per-category POI filter — toggling a category in the legend
  // hides those features by rewriting the layer filter rather than
  // tearing the source down.
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !m.getStyle()) return;
    applyPoiCategoryFilter(m);
  }, [poiCategoryVisible]);

  // Risk-tinted user layers — when a layer's colorMode flips to
  // `riskHeatmap`, bake per-segment risk against the active model's
  // cell grid and push it into the source so the trail ramp expression
  // has data to interpolate over. The ORIGINAL FeatureCollection is
  // stashed in a ref so toggling back to solid restores it cleanly.
  const userLayerOriginals = useRef(new Map<string, GeoJSON.FeatureCollection>());
  const userLayerBakedFor = useRef(new Map<string, string>());
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !m.getStyle()) return;
    const sourceFor = (id: string) =>
      m.getSource(`user-src-${id}`) as maplibregl.GeoJSONSource | undefined;
    for (const layer of userLayers) {
      if (layer.colorMode === "riskHeatmap") {
        const params = useAppStore.getState().riskParams.trails[model];
        const key = `${model}|g${params.gamma}|r${params.radius}`;
        if (userLayerBakedFor.current.get(layer.id) === key) continue;
        if (!userLayerOriginals.current.has(layer.id)) {
          userLayerOriginals.current.set(layer.id, layer.data);
        }
        const orig = userLayerOriginals.current.get(layer.id)!;
        userLayerBakedFor.current.set(layer.id, key);
        void bakeUserLayerRisk(orig, model)
          .then((baked) => {
            // Only push if no later bake has superseded us.
            if (userLayerBakedFor.current.get(layer.id) !== key) return;
            sourceFor(layer.id)?.setData(baked);
          })
          .catch(() => {
            // Cell grid missing or fetch failure — restore original so
            // the layer doesn't sit empty.
            userLayerBakedFor.current.delete(layer.id);
            sourceFor(layer.id)?.setData(orig);
          });
      } else if (userLayerBakedFor.current.has(layer.id)) {
        const orig = userLayerOriginals.current.get(layer.id);
        if (orig) sourceFor(layer.id)?.setData(orig);
        userLayerBakedFor.current.delete(layer.id);
      }
    }
  }, [userLayers, model]);

  // Drawing mode toggle: wire terra-draw on, tear it down on off.
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    if (drawingMode) {
      void startDrawing(m);
    } else {
      stopDrawing();
    }
    return () => stopDrawing();
  }, [drawingMode]);

  // Push the saved polygons array into the map source on every change.
  // Same rationale as the userLayers effect: gate on `getStyle()`, not
  // `isStyleLoaded()`. The latter goes false the moment any source has
  // pending tiles, which would silently skip every polygon update made
  // while the basemap is still warming up.
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !m.getStyle()) return;
    if (!m.getSource("user-polygons")) {
      setupUserPolygons(m, userPolygons);
    } else {
      updateUserPolygonsData(m, userPolygons);
    }
    // Keep polygons above user GPX layers so a freshly-drawn outline is
    // visible even when uploads are stacked on top of the model layers.
    bringUserPolygonsToFront(m);
  }, [userPolygons]);

  // LayersPanel's Saved areas row dispatches this event after fitBounds
  // so the user lands on the polygon and sees its stats in one motion.
  useEffect(() => {
    const onShow = (e: Event) => {
      const m = mapRef.current;
      if (!m) return;
      const id = (e as CustomEvent<{ id: string }>).detail.id;
      const polygon = useAppStore.getState().userPolygons.find((p) => p.id === id);
      if (polygon) openPolygonPopup(m, polygon);
    };
    window.addEventListener("fvg:show-polygon-stats", onShow);
    return () => window.removeEventListener("fvg:show-polygon-stats", onShow);
  }, []);

  return <div ref={ref} className={styles.root} aria-label="FVG susceptibility map" />;
}
