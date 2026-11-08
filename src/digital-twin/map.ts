import type {
  Map as MLMap,
  GeoJSONSource,
  ImageSource,
  ExpressionSpecification,
} from "maplibre-gl";
import {
  getJSON,
  sensorGeoJSON,
  windGeoJSON,
  variableMeasures,
  TWIN_DATA,
  VARIABLES,
  type Variable,
} from "./data";
import { mountTwinInteractions } from "./mapInteractions";
import { useTwinStore } from "./store";
import { useAppStore } from "@/app/store";
import { isPCREnabled, PCR_VARIABLES } from "@/regional/builtins";
import { useRegionalStore } from "@/regional/store";
const SENSOR = "twin-sensors",
  WIND = "twin-wind",
  AIA = "twin-aia",
  BUILDINGS = "twin-buildings",
  RADAR = "twin-radar";
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
/** Observations share the same map and camera as every hazard/context layer. */
export function mountTwinMap(map: MLMap): () => void {
  let ready = false,
    disposed = false,
    radarKey = "",
    lastMinute = -1,
    lastMeasures: ReturnType<typeof useTwinStore.getState>["measures"] | null =
      null;
  let assets: GeoJSON.FeatureCollection | null = null,
    buildings: GeoJSON.FeatureCollection | null = null,
    buildingsVersion = "";
  function buildingVersion() {
    const s = useRegionalStore.getState();
    return (
      (s.catalog?.layers.find((l) => l.id === "twin-buildings")?.retrievedAt ??
        "initial") +
      ":" +
      s.refreshKey
    );
  }
  let pendingScene: keyof typeof SCENES | null = null,
    pendingStation: number | null = null,
    pendingFit = false;
  let pendingBounds: [[number, number], [number, number]] | null = null,
    navigationFrame = 0,
    layoutFrame = 0;
  const ac = new AbortController(),
    loading = new Set<string>(),
    sourceData = new Map<string, GeoJSON.FeatureCollection>();
  const observations = new Map<Variable, GeoJSON.FeatureCollection>();
  let windData: GeoJSON.FeatureCollection = empty;
  const interactions = mountTwinInteractions(map, () => ready && !disposed);
  function applyPadding() {
    if (!ready || disposed) return;
    const containerElement = map.getContainer();
    // MapLibre listens to window resizing, while flex/sheet layout can resize
    // its container independently (notably during Safari's first layout).
    if (containerElement.clientWidth > 0 && containerElement.clientHeight > 0) {
      const canvas = map.getCanvas();
      if (
        canvas.clientWidth !== containerElement.clientWidth ||
        canvas.clientHeight !== containerElement.clientHeight
      )
        map.resize();
    }
    const panel = document.getElementById("drawer-panel"),
      container = map.getContainer().getBoundingClientRect();
    const padding = { top: 0, bottom: 0, left: 0, right: 0 };
    if (
      panel &&
      useAppStore.getState().drawerOpen &&
      getComputedStyle(panel).position === "absolute"
    ) {
      const r = panel.getBoundingClientRect();
      if (r.width >= container.width - 1)
        padding.bottom = Math.max(0, container.bottom - r.top);
      else padding.right = Math.max(0, container.right - r.left);
    }
    const current = map.getPadding();
    if (
      Object.entries(padding).some(
        ([k, v]) => current[k as keyof typeof current] !== v,
      )
    )
      map.setPadding(padding);
  }
  function layout() {
    cancelAnimationFrame(layoutFrame);
    layoutFrame = requestAnimationFrame(applyPadding);
  }
  const observer = new ResizeObserver(layout);
  observer.observe(map.getContainer());
  const panel = document.getElementById("drawer-panel");
  if (panel) observer.observe(panel);
  function source(id: string, data: GeoJSON.FeatureCollection) {
    if (!map.getSource(id)) map.addSource(id, { type: "geojson", data });
    else if (sourceData.get(id) !== data)
      (map.getSource(id) as GeoJSONSource).setData(data);
    sourceData.set(id, data);
  }
  function visible(id: string, on: boolean) {
    if (map.getLayer(id))
      map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
  }
  function sync() {
    if (!ready || disposed) return;
    const s = useTwinStore.getState(),
      minute = Math.floor(Date.now() / 60000);
    if (s.measures !== lastMeasures || minute !== lastMinute) {
      observations.clear();
      windData = windGeoJSON(s.measures, "wind");
      lastMeasures = s.measures;
      lastMinute = minute;
      interactions.invalidateHover();
    }
    const fontLayer = map
      .getStyle()
      .layers.find(
        (l) =>
          l.type === "symbol" &&
          Array.isArray(l.layout?.["text-font"]) &&
          l.layout["text-font"].every((x) => typeof x === "string"),
      );
    const fonts =
      fontLayer?.type === "symbol"
        ? (fontLayer.layout?.["text-font"] as string[])
        : ["Open Sans Semibold"];
    for (const variable of PCR_VARIABLES) {
      const id = `${SENSOR}-${variable}`,
        on = s.active && isPCREnabled(variable),
        v = VARIABLES[variable];
      if (on) {
        if (!observations.has(variable))
          observations.set(variable, sensorGeoJSON(s.measures, variable));
        source(id, observations.get(variable)!);
        const color: string | ExpressionSpecification = [
          "case",
          ["get", "stale"],
          "#888888",
          v.comparable
            ? [
                "interpolate",
                ["linear"],
                ["get", "value"],
                v.min,
                v.colors[0],
                (v.min + v.max) / 2,
                v.colors[1],
                v.max,
                v.colors[2],
              ]
            : "#5ebfcc",
        ];
        if (!map.getLayer(id))
          map.addLayer({
            id,
            type: "circle",
            source: id,
            paint: {
              "circle-radius": [
                "interpolate",
                ["linear"],
                ["get", "scaleFraction"],
                0,
                5,
                1,
                11,
              ],
              "circle-color": color,
              "circle-stroke-color": "#172624",
              "circle-stroke-width": 1.5,
            },
          });
        if (!map.getLayer(id + "-labels"))
          map.addLayer({
            id: id + "-labels",
            type: "symbol",
            source: id,
            minzoom: 11,
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
        const opacity =
          useRegionalStore.getState().opacity["pcr-" + variable] ?? 1;
        map.setPaintProperty(id, "circle-opacity", opacity);
        map.setPaintProperty(id + "-labels", "text-opacity", opacity);
      }
      visible(id, on);
      visible(id + "-labels", on);
    }
    const windOn = s.active && isPCREnabled("wind");
    if (windOn) {
      source(WIND, windData);
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
    }
    visible(WIND, windOn);
    if (map.getLayer(WIND))
      map.setPaintProperty(
        WIND,
        "line-opacity",
        useRegionalStore.getState().opacity["pcr-wind"] ?? 1,
      );
    if (s.active && s.buildingsOn) {
      source(BUILDINGS, buildings ?? empty);
      if (!map.getLayer(BUILDINGS))
        map.addLayer({
          id: BUILDINGS,
          type: "fill",
          source: BUILDINGS,
          minzoom: 12,
          paint: {
            "fill-color": [
              "case",
              ["get", "heightKnown"],
              "#9caca7",
              "#777777",
            ],
            "fill-opacity": 0.7,
          },
        });
      if (!map.getLayer(BUILDINGS + "-3d"))
        map.addLayer({
          id: BUILDINGS + "-3d",
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
    }
    const buildingOpacity =
      useRegionalStore.getState().opacity["twin-buildings"] ?? 0.7;
    if (map.getLayer(BUILDINGS))
      map.setPaintProperty(BUILDINGS, "fill-opacity", buildingOpacity);
    if (map.getLayer(BUILDINGS + "-3d"))
      map.setPaintProperty(
        BUILDINGS + "-3d",
        "fill-extrusion-opacity",
        buildingOpacity,
      );
    visible(BUILDINGS, s.active && s.buildingsOn);
    visible(
      BUILDINGS + "-3d",
      s.active && s.buildingsOn && useAppStore.getState().view3D,
    );
    if (s.active && s.assetsOn) {
      source(AIA, assets ?? empty);
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
    }
    visible(AIA, s.active && s.assetsOn);
    if (s.active && s.radar && s.radarOn) {
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
    if (map.getLayer(RADAR))
      map.setPaintProperty(
        RADAR,
        "raster-opacity",
        useRegionalStore.getState().opacity["pcr-radar"] ?? 0.65,
      );
    visible(RADAR, s.active && s.radarOn);
    interactions.sync();
  }
  async function load(kind: "assets" | "buildings") {
    if (loading.has(kind)) return;
    loading.add(kind);
    const version = buildingVersion();
    try {
      const d = (await getJSON(
        `${TWIN_DATA}${kind === "assets" ? "aia" : "buildings"}.geojson?v=${encodeURIComponent(version)}`,
        ac.signal,
      )) as GeoJSON.FeatureCollection;
      if (d.type !== "FeatureCollection" || !Array.isArray(d.features))
        throw Error("Geometrie non valide");
      if (disposed) return;
      if (kind === "assets") assets = d;
      else {
        buildings = d;
        buildingsVersion = version;
      }
      useTwinStore.setState(
        kind === "assets" ? { assetsError: null } : { buildingsError: null },
      );
      sync();
    } catch (e) {
      if (!disposed)
        useTwinStore.setState(
          kind === "assets"
            ? { assetsError: String(e) }
            : { buildingsError: String(e) },
        );
    } finally {
      loading.delete(kind);
    }
  }
  function changed() {
    const s = useTwinStore.getState();
    if (s.active && s.assetsOn && !assets) void load("assets");
    if (
      s.active &&
      s.buildingsOn &&
      (!buildings || buildingsVersion !== buildingVersion())
    )
      void load("buildings");
    sync();
    layout();
    navigation();
  }
  function scene(name: keyof typeof SCENES) {
    pendingScene = null;
    applyPadding();
    map.jumpTo({
      ...SCENES[name],
      pitch: useAppStore.getState().view3D ? SCENES[name].pitch : 0,
    });
  }
  function navigation() {
    if (pendingStation === null && !pendingFit && !pendingBounds) return;
    cancelAnimationFrame(navigationFrame);
    navigationFrame = requestAnimationFrame(() => {
      if (!ready || disposed) return;
      applyPadding();
      const s = useTwinStore.getState(),
        rows = variableMeasures(s.measures, s.variable);
      const duration = window.matchMedia?.("(prefers-reduced-motion: reduce)")
        .matches
        ? 0
        : 420;
      if (pendingBounds) {
        const bounds = pendingBounds;
        pendingBounds = null;
        map.fitBounds(bounds, { padding: 24, maxZoom: 15, pitch: 0, duration });
      } else if (pendingStation !== null) {
        if (!rows.length) return;
        const m = rows.find((x) => x.stationId === pendingStation);
        pendingStation = null;
        if (m)
          map.flyTo({
            center: [m.lon, m.lat],
            zoom: Math.max(12.6, Math.min(map.getZoom(), 15)),
            duration,
            essential: false,
          });
      } else if (pendingFit && rows.length) {
        pendingFit = false;
        if (rows.length === 1)
          map.flyTo({
            center: [rows[0]!.lon, rows[0]!.lat],
            zoom: 12.6,
            duration,
            essential: false,
          });
        else {
          const x = rows.map((m) => m.lon),
            y = rows.map((m) => m.lat);
          map.fitBounds(
            [
              [Math.min(...x), Math.min(...y)],
              [Math.max(...x), Math.max(...y)],
            ],
            { padding: 24, maxZoom: 13.2, pitch: 0, duration },
          );
        }
      }
    });
  }
  function style() {
    ready = true;
    sourceData.clear();
    radarKey = "";
    sync();
    layout();
    if (pendingScene) scene(pendingScene);
    navigation();
  }
  function styleLoading() {
    interactions.reset();
    ready = false;
  }
  const onScene = (e: Event) => {
    const n = (e as CustomEvent<string>).detail;
    if (n in SCENES) {
      pendingStation = null;
      pendingFit = false;
      pendingBounds = null;
      if (ready) scene(n as keyof typeof SCENES);
      else pendingScene = n as keyof typeof SCENES;
    }
  };
  const onStation = (e: Event) => {
    const n = (e as CustomEvent<unknown>).detail;
    if (Number.isInteger(n)) {
      pendingStation = n as number;
      pendingFit = false;
      pendingScene = null;
      layout();
      navigation();
    }
  };
  const onFit = () => {
    pendingFit = true;
    pendingStation = null;
    pendingScene = null;
    layout();
    navigation();
  };
  const onBounds = (e: Event) => {
    const b = (e as CustomEvent<unknown>).detail;
    if (
      Array.isArray(b) &&
      b.length === 2 &&
      b.every(
        (p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite),
      )
    ) {
      pendingBounds = b as [[number, number], [number, number]];
      pendingStation = null;
      pendingFit = false;
      pendingScene = null;
      layout();
      navigation();
    }
  };
  map.on("style.load", style);
  map.on("styledataloading", styleLoading);
  map.on("resize", layout);
  window.addEventListener("fvg:twin-scene", onScene);
  window.addEventListener("fvg:twin-station", onStation);
  window.addEventListener("fvg:twin-fit", onFit);
  window.addEventListener("fvg:regional-fit", onBounds);
  const unsub = useTwinStore.subscribe(changed),
    unsubR = useRegionalStore.subscribe((s, p) => {
      if (
        s.enabled !== p.enabled ||
        s.opacity !== p.opacity ||
        s.catalog !== p.catalog ||
        s.refreshKey !== p.refreshKey
      )
        changed();
    }),
    unsubA = useAppStore.subscribe((s, p) => {
      if (s.view3D !== p.view3D) sync();
      if (s.drawerOpen !== p.drawerOpen) layout();
    });
  const timer = setInterval(() => {
    if (!document.hidden) sync();
  }, 60000);
  changed();
  return () => {
    disposed = true;
    ac.abort();
    interactions.dispose();
    observer.disconnect();
    cancelAnimationFrame(navigationFrame);
    cancelAnimationFrame(layoutFrame);
    clearInterval(timer);
    unsub();
    unsubR();
    unsubA();
    map.off("style.load", style);
    map.off("styledataloading", styleLoading);
    map.off("resize", layout);
    window.removeEventListener("fvg:twin-scene", onScene);
    window.removeEventListener("fvg:twin-station", onStation);
    window.removeEventListener("fvg:twin-fit", onFit);
    window.removeEventListener("fvg:regional-fit", onBounds);
  };
}
