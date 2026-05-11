import type { Map as MLMap, GeoJSONSource } from "maplibre-gl";
import type {
  ExpressionSpecification,
  FilterSpecification,
} from "@maplibre/maplibre-gl-style-spec";
import { useAppStore } from "@/app/store";
import type { ModelId } from "@/app/types";
import { CriticalPoiFeatureCollectionSchema, parseOrThrow } from "@/lib/schemas";

/**
 * Critical points + alpine huts overlay.
 *
 * Single static GeoJSON source (`poi_fvg.geojson`) with per-feature
 * `risk_j2` / `risk_j3` baked at build time. Two symbol layers, each
 * filtered by the `group` property:
 *
 *   - "critical" → hospital, school, fire_station, police
 *   - "huts"     → alpine_hut, wilderness_hut
 *
 * Each category uses its own SDF icon (loaded on demand via the map's
 * `styleimagemissing` event). The icon shape conveys *what* the structure
 * is; the icon color (a single-channel tint applied to the SDF) conveys
 * the per-feature landslide risk for the active model.
 */

export const POI_SOURCE = "poi-static";
export const POI_CRITICAL = "poi-critical";
export const POI_HUTS = "poi-huts";

const DATA_URL_KEY = "poi_fvg.geojson";

let poiRaw: GeoJSON.FeatureCollection | null = null;
let poiInFlight: Promise<GeoJSON.FeatureCollection> | null = null;

async function loadPoi(): Promise<GeoJSON.FeatureCollection> {
  if (poiRaw) return poiRaw;
  if (!poiInFlight) {
    poiInFlight = (async () => {
      const url = `${import.meta.env.BASE_URL}data/${DATA_URL_KEY}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${DATA_URL_KEY}: ${res.status}`);
      const json: unknown = await res.json();
      const validated = parseOrThrow(CriticalPoiFeatureCollectionSchema, json, DATA_URL_KEY);
      return validated as GeoJSON.FeatureCollection;
    })();
  }
  poiRaw = await poiInFlight;
  return poiRaw;
}

/**
 * Phosphor Icons (fill weight) vendored under `public/icons/poi-*.svg`.
 * Filled silhouettes work well with SDF: the alpha channel becomes the
 * mask, and MapLibre's `icon-color` paints the result at any resolution.
 *
 * Re-bake by running `npm run build:icons`.
 */
const ICON_CATEGORIES = [
  "hospital", "school", "fire_station", "police",
  "alpine_hut", "wilderness_hut",
] as const;

const ICON_PX = 96;

async function loadIconImageData(category: string, size: number): Promise<ImageData> {
  const url = `${import.meta.env.BASE_URL}icons/poi-${category}.svg`;
  const img = new Image(size, size);
  img.src = url;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d canvas context");
  ctx.drawImage(img, 0, 0, size, size);
  return ctx.getImageData(0, 0, size, size);
}

let missingHandlerInstalled = false;

function installIconLoader(m: MLMap): void {
  if (missingHandlerInstalled) return;
  missingHandlerInstalled = true;
  m.on("styleimagemissing", (e) => {
    const id = e.id;
    if (!id.startsWith("poi-")) return;
    if (m.hasImage(id)) return;
    const category = id.slice("poi-".length);
    if (!(ICON_CATEGORIES as readonly string[]).includes(category)) return;
    void loadIconImageData(category, ICON_PX).then((data) => {
      // hasImage guard: the missing event can fire repeatedly while the
      // load is in flight.
      if (m.hasImage(id)) return;
      m.addImage(id, data, { sdf: true });
    });
  });
}

function iconColor(model: ModelId): ExpressionSpecification {
  const prop = model === "j2" ? "risk_j2" : "risk_j3";
  return [
    "interpolate", ["linear"],
    ["coalesce", ["get", prop], 0],
    0.00, "#22D3FF",
    0.10, "#9FD9D2",
    0.25, "#FFD17A",
    0.45, "#FF7A3D",
    0.70, "#C8191E",
    1.00, "#5F0810",
  ];
}

const FILTER_CRITICAL: FilterSpecification = ["==", ["get", "group"], "critical"];
const FILTER_HUTS: FilterSpecification = ["==", ["get", "group"], "huts"];

const ICON_IMAGE: ExpressionSpecification = ["concat", "poi-", ["get", "category"]];

// Sizes are tuned for `ICON_PX` raster (96 px). icon-size=1 means the icon
// renders at native pixel size, so values < 0.3 keep dots tight and
// readable at high zoom.
const ICON_SIZE: ExpressionSpecification = [
  "interpolate", ["linear"], ["zoom"],
  6, ["*", ["coalesce", ["get", "importance"], 4], 0.022],
  11, ["*", ["coalesce", ["get", "importance"], 4], 0.040],
  14, ["*", ["coalesce", ["get", "importance"], 4], 0.060],
];

function addSymbolLayer(
  m: MLMap,
  id: string,
  filter: FilterSpecification,
  visible: boolean,
  model: ModelId,
  haloColor: string,
): void {
  m.addLayer({
    id,
    type: "symbol",
    source: POI_SOURCE,
    filter,
    layout: {
      "icon-image": ICON_IMAGE,
      "icon-size": ICON_SIZE,
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
      "icon-anchor": "center",
      visibility: visible ? "visible" : "none",
    },
    paint: {
      "icon-color": iconColor(model),
      "icon-halo-color": haloColor,
      "icon-halo-width": 1.6,
      "icon-opacity": 0.95,
    },
  });
}

export function addCriticalPoi(
  m: MLMap,
  criticalVisible: boolean,
  hutsVisible: boolean,
): void {
  for (const id of [POI_CRITICAL, POI_HUTS]) {
    if (m.getLayer(id)) m.removeLayer(id);
  }
  if (m.getSource(POI_SOURCE)) m.removeSource(POI_SOURCE);

  installIconLoader(m);

  m.addSource(POI_SOURCE, {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });

  const model = useAppStore.getState().model;
  // Critical buildings get a stark white halo so they pop on dark basemaps.
  addSymbolLayer(m, POI_CRITICAL, FILTER_CRITICAL, criticalVisible, model, "#FFFFFF");
  // Huts get a warm cream halo — keeps them visually distinct from the
  // critical category even when they happen to share a risk colour.
  addSymbolLayer(m, POI_HUTS, FILTER_HUTS, hutsVisible, model, "#F2D7A5");

  void loadPoi().then((fc) => {
    const src = m.getSource(POI_SOURCE) as GeoJSONSource | undefined;
    src?.setData(fc);
  });
}

export function setCriticalVisible(m: MLMap, v: boolean): void {
  if (m.getLayer(POI_CRITICAL)) {
    m.setLayoutProperty(POI_CRITICAL, "visibility", v ? "visible" : "none");
  }
}

export function setHutsVisible(m: MLMap, v: boolean): void {
  if (m.getLayer(POI_HUTS)) {
    m.setLayoutProperty(POI_HUTS, "visibility", v ? "visible" : "none");
  }
}

export function applyPoiModel(m: MLMap): void {
  const model = useAppStore.getState().model;
  for (const id of [POI_CRITICAL, POI_HUTS]) {
    if (m.getLayer(id)) {
      m.setPaintProperty(id, "icon-color", iconColor(model));
    }
  }
}
