import type { Map as MLMap, GeoJSONSource, ImageSource } from "maplibre-gl";
import {
  getJSON,
  sensorGeoJSON,
  windGeoJSON,
  variableMeasures,
  TWIN_DATA,
  VARIABLES,
} from "./data";
import { mountTwinInteractions } from "./mapInteractions";
import { useTwinStore } from "./store";
import { useAppStore } from "@/app/store";
const SENSOR = "twin-sensors",
  WIND = "twin-wind",
  AIA = "twin-aia",
  BUILDINGS = "twin-buildings",
  RADAR = "twin-radar";
const ids = [
  RADAR,
  BUILDINGS,
  `${BUILDINGS}-3d`,
  AIA,
  WIND,
  SENSOR,
  `${SENSOR}-labels`,
];
const empty: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};
export const SCENES = {
  coast: { center: [13.66, 45.725] as [number, number], zoom: 10.5, pitch: 35 },
  trieste: {
    center: [13.769, 45.646] as [number, number],
    zoom: 14.2,
    pitch: 55,
  },
  monfalcone: {
    center: [13.54, 45.804] as [number, number],
    zoom: 14.2,
    pitch: 55,
  },
};
/** Owns only the twin layers. Basemap replacement replays cached sources. */
export function mountTwinMap(map: MLMap): () => void {
  let ready = false,
    disposed = false,
    lastActive = false,
    lastKey = -1,
    radarKey = "",
    assets: GeoJSON.FeatureCollection | null = null,
    buildings: GeoJSON.FeatureCollection | null = null;
  let pendingScene: keyof typeof SCENES | null = null;
  let pendingStation: number | null = null, pendingFit = false, navigationFrame = 0;
  const interactions = mountTwinInteractions(map, () => ready && !disposed);
  const sourceData = new Map<string, GeoJSON.FeatureCollection>();
  let lastMeasures: ReturnType<typeof useTwinStore.getState>["measures"] | null = null;
  let lastVariable = "", lastMinute = -1;
  let sensorData: GeoJSON.FeatureCollection = empty, windData: GeoJSON.FeatureCollection = empty;
  const loading = new Set<string>();
  const ac = new AbortController();
  let previousCamera: {
    center: [number, number];
    zoom: number;
    pitch: number;
    bearing: number;
    padding: ReturnType<MLMap["getPadding"]>;
  } | null = null;
  let layoutFrame = 0;
  function applyPadding() {
    if (!ready || disposed || !useTwinStore.getState().active) return;
    const panel = document.getElementById("drawer-panel");
    const container = map.getContainer().getBoundingClientRect();
    const padding = { top: 0, bottom: 0, left: 0, right: 0 };
    if (panel && useAppStore.getState().drawerOpen && getComputedStyle(panel).position === "absolute") {
      const rect = panel.getBoundingClientRect();
      if (rect.width >= container.width - 1)
        padding.bottom = Math.max(0, container.bottom - rect.top);
      else
        padding.right = Math.max(0, container.right - rect.left);
    }
    const current = map.getPadding();
    if (Object.entries(padding).some(([key, value]) => current[key as keyof typeof current] !== value))
      map.setPadding(padding);
  }
  function layout() {
    cancelAnimationFrame(layoutFrame);
    layoutFrame = requestAnimationFrame(applyPadding);
  }
  // Keep the observed location in the part of the map not covered by the
  // mobile sheet. This also follows rotation and dynamic browser toolbars.
  const layoutObserver = new ResizeObserver(layout);
  layoutObserver.observe(map.getContainer());
  const panel = document.getElementById("drawer-panel");
  if (panel) layoutObserver.observe(panel);
  function source(id: string, data: GeoJSON.FeatureCollection) {
    if (!map.getSource(id)) map.addSource(id, { type: "geojson", data });
    else if (sourceData.get(id) !== data) (map.getSource(id) as GeoJSONSource).setData(data);
    sourceData.set(id, data);
  }
  function sync() {
    if (!ready || disposed) return;
    const s = useTwinStore.getState();
    if (!s.active) {
      for (const id of ids)
        if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", "none");
      interactions.sync();
      return;
    }
    const minute = Math.floor(Date.now() / 60000);
    if (lastMeasures !== s.measures || lastVariable !== s.variable || lastMinute !== minute) {
      interactions.invalidateHover();
      sensorData = sensorGeoJSON(s.measures, s.variable);
      windData = windGeoJSON(s.measures, s.variable);
      lastMeasures = s.measures; lastVariable = s.variable; lastMinute = minute;
    }
    source(SENSOR, sensorData);
    source(WIND, windData);
    source(AIA, assets ?? empty);
    source(BUILDINGS, buildings ?? empty);
    // Put precipitation below context, buildings and measured point observations.
    if (s.radar && s.radarOn) {
      if (!map.getSource(RADAR)) {
        map.addSource(RADAR, {
          type: "image",
          url: s.radar.url,
          coordinates: s.radar.coordinates,
        });
        radarKey = s.radar.url;
      } else if (radarKey !== s.radar.url) {
        (map.getSource(RADAR) as ImageSource).updateImage({
          url: s.radar.url,
          coordinates: s.radar.coordinates,
        });
        radarKey = s.radar.url;
      }
      if (!map.getLayer(RADAR))
        map.addLayer(
          {
            id: RADAR,
            type: "raster",
            source: RADAR,
            paint: { "raster-opacity": 0.65, "raster-fade-duration": 0 },
          },
          map.getLayer(BUILDINGS) ? BUILDINGS : undefined,
        );
    }
    if (!map.getLayer(BUILDINGS))
      map.addLayer({
        id: BUILDINGS,
        type: "fill",
        source: BUILDINGS,
        minzoom: 12,
        paint: {
          "fill-color": ["case", ["get", "heightKnown"], "#9caca7", "#777777"],
          "fill-opacity": 0.7,
        },
      });
    if (!map.getLayer(`${BUILDINGS}-3d`))
      map.addLayer({
        id: `${BUILDINGS}-3d`,
        type: "fill-extrusion",
        source: BUILDINGS,
        minzoom: 12,
        filter: ["==", ["get", "heightKnown"], true],
        paint: {
          "fill-extrusion-height": ["get", "height"],
          "fill-extrusion-color": "#a3b8b4",
          "fill-extrusion-opacity": 0.9,
          "fill-extrusion-base": 0,
        },
      });
    if (!map.getLayer(AIA))
      map.addLayer({
        id: AIA,
        type: "circle",
        source: AIA,
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 4, 15, 8],
          "circle-color": "#e0b361",
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#322c20",
        },
      });
    if (!map.getLayer(WIND))
      map.addLayer({
        id: WIND,
        type: "line",
        source: WIND,
        paint: {
          "line-color": ["case", ["get", "stale"], "#888888", "#5ebfcc"],
          "line-width": 2,
        },
      });
    if (!map.getLayer(SENSOR))
      map.addLayer({
        id: SENSOR,
        type: "circle",
        source: SENSOR,
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["get", "scaleFraction"], 0, 5, 1, 11],
          "circle-stroke-color": "#172624",
          "circle-stroke-width": 1.5,
        },
      });
    const fontLayer = map
      .getStyle()
      .layers.find(
        (layer) =>
          layer.type === "symbol" &&
          Array.isArray(layer.layout?.["text-font"]) &&
          layer.layout["text-font"].every((value) => typeof value === "string"),
      );
    const fonts =
      fontLayer?.type === "symbol"
        ? (fontLayer.layout?.["text-font"] as string[])
        : ["Open Sans Semibold"];
    if (!map.getLayer(`${SENSOR}-labels`))
      map.addLayer({
        id: `${SENSOR}-labels`,
        type: "symbol",
        source: SENSOR,
        minzoom: 10,
        layout: {
          "text-field": ["get", "label"],
          "text-font": fonts ?? ["Open Sans Semibold"],
          "text-size": 12,
          "text-offset": [0, 1.4],
          "text-anchor": "top",
        },
        paint: {
          "text-color": "#172624",
          "text-halo-color": "#f6f5ec",
          "text-halo-width": 1.5,
        },
      });
    const v = VARIABLES[s.variable];
    map.setPaintProperty(SENSOR, "circle-color", [
      "case",
      ["get", "stale"],
      "#888888",
      v.comparable ? [
        "interpolate",
        ["linear"],
        ["get", "value"],
        v.min,
        v.colors[0],
        (v.min + v.max) / 2,
        v.colors[1],
        v.max,
        v.colors[2],
      ] : "#5ebfcc",
    ]);
    for (const id of ids)
      if (map.getLayer(id))
        map.setLayoutProperty(
          id,
          "visibility",
          (id === RADAR && !s.radarOn) ||
            (id === AIA && !s.assetsOn) ||
            ((id === BUILDINGS || id === `${BUILDINGS}-3d`) &&
              !s.buildingsOn) ||
            (id === `${BUILDINGS}-3d` && !useAppStore.getState().view3D)
            ? "none"
            : "visible",
        );
    interactions.sync();
  }
  async function load(kind: "assets" | "buildings") {
    if (loading.has(kind)) return;
    loading.add(kind);
    try {
      const data = (await getJSON(
        `${TWIN_DATA}${kind === "assets" ? "aia" : "buildings"}.geojson`,
        ac.signal,
      )) as GeoJSON.FeatureCollection;
      if (data.type !== "FeatureCollection" || !Array.isArray(data.features))
        throw new Error("Geometrie non valide");
      if (disposed) return;
      if (kind === "assets") assets = data;
      else buildings = data;
      useTwinStore.setState(
        kind === "assets" ? { assetsError: null } : { buildingsError: null },
      );
      sync();
    } catch (e) {
      if (!disposed)
        useTwinStore.setState(
          kind === "assets"
            ? {
                assetsError:
                  e instanceof Error ? e.message : "Impianti non disponibili",
              }
            : {
                buildingsError:
                  e instanceof Error ? e.message : "Edifici non disponibili",
              },
        );
    } finally { loading.delete(kind); }
  }
  function changed() {
    const s = useTwinStore.getState();
    const started = s.active && !lastActive,
      stopped = !s.active && lastActive,
      key = s.refreshKey !== lastKey;
    if (started) {
      pendingScene = "coast";
      const center = map.getCenter();
      previousCamera = {
        center: [center.lng, center.lat],
        zoom: map.getZoom(),
        pitch: map.getPitch(),
        bearing: map.getBearing(),
        padding: map.getPadding(),
      };
    }
    if (stopped) {
      pendingScene = null;
      pendingStation = null; pendingFit = false;
      if (previousCamera) map.jumpTo(previousCamera);
    }
    lastActive = s.active;
    lastKey = s.refreshKey;
    if (s.active && (started || key)) {
      if (!assets) void load("assets");
      if (!buildings) void load("buildings");
      if (started && ready) scene("coast");
    }
    sync();
    layout();
    navigation();
  }
  function style() {
    ready = true;
    sourceData.clear();
    radarKey = "";
    sync();
    layout();
    if (pendingScene && useTwinStore.getState().active) scene(pendingScene);
    navigation();
  }
  function styleLoading() {
    interactions.reset();
    ready = false;
  }
  function scene(name: keyof typeof SCENES) {
    pendingScene = null;
    map.jumpTo({
      ...SCENES[name],
      pitch: useAppStore.getState().view3D ? SCENES[name].pitch : 0,
    });
  }
  function navigation() {
    if (pendingStation === null && !pendingFit) return;
    cancelAnimationFrame(navigationFrame);
    navigationFrame = requestAnimationFrame(() => {
      if (!ready || disposed || !useTwinStore.getState().active) return;
      // Closing the sheet can requeue layout after this RAF. Apply the final
      // inset first: setPadding calls jumpTo and would otherwise stop flyTo.
      applyPadding();
      const state = useTwinStore.getState();
      const rows = variableMeasures(state.measures, state.variable);
      if (!rows.length) return; // Retry when observations arrive.
      const duration = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? 0 : 420;
      if (pendingStation !== null) {
        const measure = rows.find(m => m.stationId === pendingStation);
        pendingStation = null;
        if (measure) map.flyTo({ center: [measure.lon, measure.lat], zoom: Math.max(12.6, Math.min(map.getZoom(), 15)), duration, essential: false });
      } else if (pendingFit) {
        pendingFit = false;
        if (rows.length === 1) {
          map.flyTo({ center: [rows[0]!.lon, rows[0]!.lat], zoom: 12.6, duration, essential: false });
        } else {
          const lons = rows.map(m => m.lon), lats = rows.map(m => m.lat);
          map.fitBounds([[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]], {
            // MapLibre already accounts for the current transform padding.
            padding: 24,
            maxZoom: 13.2, pitch: 0, duration,
          });
        }
      }
    });
  }
  const onStation = (event: Event) => {
    const stationId = (event as CustomEvent<unknown>).detail;
    if (!Number.isInteger(stationId) || !useTwinStore.getState().active) return;
    pendingStation = stationId as number; pendingFit = false; pendingScene = null;
    layout(); navigation();
  };
  const onFit = () => {
    if (!useTwinStore.getState().active) return;
    pendingFit = true; pendingStation = null; pendingScene = null;
    layout(); navigation();
  };
  const onScene = (event: Event) => {
    const name = (event as CustomEvent<string>).detail;
    if (name in SCENES && useTwinStore.getState().active) {
      pendingStation = null; pendingFit = false;
      if (ready) scene(name as keyof typeof SCENES);
      else pendingScene = name as keyof typeof SCENES;
    }
  };
  map.on("style.load", style);
  map.on("styledataloading", styleLoading);
  map.on("resize", layout);
  window.addEventListener("fvg:twin-scene", onScene);
  window.addEventListener("fvg:twin-station", onStation);
  window.addEventListener("fvg:twin-fit", onFit);
  const unsub = useTwinStore.subscribe(changed),
    unsubApp = useAppStore.subscribe((s, p) => {
      if (s.view3D !== p.view3D) sync();
      if (s.drawerOpen !== p.drawerOpen) layout();
    });
  const ageTimer = setInterval(() => {
    if (useTwinStore.getState().active) sync();
  }, 60000);
  changed();
  return () => {
    disposed = true;
    cancelAnimationFrame(navigationFrame);
    interactions.dispose();
    cancelAnimationFrame(layoutFrame);
    layoutObserver.disconnect();
    ac.abort();
    clearInterval(ageTimer);
    unsub();
    unsubApp();
    map.off("style.load", style);
    map.off("styledataloading", styleLoading);
    map.off("resize", layout);
    window.removeEventListener("fvg:twin-scene", onScene);
    window.removeEventListener("fvg:twin-station", onStation);
    window.removeEventListener("fvg:twin-fit", onFit);
  };
}
