import type { Map as MLMap, GeoJSONSource } from "maplibre-gl";
import type {
  DataDrivenPropertyValueSpecification,
  ExpressionSpecification,
  FilterSpecification,
} from "@maplibre/maplibre-gl-style-spec";
import { useAppStore } from "@/app/store";
import { POI_CATEGORIES, POI_DEFAULT_COLORS, type PoiCategory } from "@/app/types";
import { CriticalPoiFeatureCollectionSchema, parseOrThrow } from "@/lib/schemas";

/**
 * Critical structures + alpine huts overlay rendered as a SINGLE
 * gaussian-blurred circle per group that breathes in and out via a
 * requestAnimationFrame loop. The previous three-tier stack (glow +
 * halo + core) was tweaked away — a single feathered circle reads as
 * one cleaner point of light, and we animate both radius and opacity
 * so the breath is more legible than radius alone.
 *
 * Visibility lives at two levels:
 *  • group switch (`layers.poiCritical` / `layers.poiHuts`) — gates the
 *    whole layer via `visibility`.
 *  • per-category switch (`poiCategoryVisible`) — folded into the
 *    layer's `filter` so individual categories can be hidden without
 *    tearing down the source.
 */

export const POI_SOURCE = "poi-static";

function layerId(group: "critical" | "huts"): string {
  return `poi-${group}`;
}
export const POI_CRITICAL = layerId("critical");
export const POI_HUTS = layerId("huts");

const DATA_URL_KEY = "poi_fvg.geojson";

const CRITICAL_CATEGORIES: PoiCategory[] = ["hospital", "fire_station", "police", "school"];
const HUTS_CATEGORIES: PoiCategory[] = ["alpine_hut", "wilderness_hut"];

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
      const validated = parseOrThrow(
        CriticalPoiFeatureCollectionSchema,
        json,
        DATA_URL_KEY,
      );
      return validated as GeoJSON.FeatureCollection;
    })();
  }
  poiRaw = await poiInFlight;
  return poiRaw;
}

function colorByCategory(): DataDrivenPropertyValueSpecification<string> {
  const colors = useAppStore.getState().poiColors;
  const expr: unknown = [
    "match",
    ["get", "category"],
    "hospital", colors.hospital ?? POI_DEFAULT_COLORS.hospital,
    "fire_station", colors.fire_station ?? POI_DEFAULT_COLORS.fire_station,
    "police", colors.police ?? POI_DEFAULT_COLORS.police,
    "school", colors.school ?? POI_DEFAULT_COLORS.school,
    "alpine_hut", colors.alpine_hut ?? POI_DEFAULT_COLORS.alpine_hut,
    "wilderness_hut", colors.wilderness_hut ?? POI_DEFAULT_COLORS.wilderness_hut,
    /* default */ POI_DEFAULT_COLORS.school,
  ];
  return expr as DataDrivenPropertyValueSpecification<string>;
}

export function applyPoiColors(m: import("maplibre-gl").Map): void {
  const expr = colorByCategory();
  for (const group of ["critical", "huts"] as const) {
    const id = layerId(group);
    if (m.getLayer(id)) m.setPaintProperty(id, "circle-color", expr);
  }
}

export type { PoiCategory };

/** Build the layer filter: group AND visible categories. Each group's
 *  filter is dynamic so toggling a category in the legend hides those
 *  features without re-baking the source. When all categories in a
 *  group are off, MapLibre receives a filter that excludes every row —
 *  cheaper than fiddling with `visibility`. */
function buildFilter(group: "critical" | "huts"): FilterSpecification {
  const visible = useAppStore.getState().poiCategoryVisible;
  const inGroup = group === "critical" ? CRITICAL_CATEGORIES : HUTS_CATEGORIES;
  const allowed = inGroup.filter((c) => visible[c]);
  // ["in", ["get", "category"], ["literal", [...]]] — match the feature's
  // category against an inline list. Empty allowed list → match against
  // an empty array → always false → nothing rendered. That's the desired
  // behaviour when every category in the group is toggled off.
  return [
    "all",
    ["==", ["get", "group"], group],
    ["in", ["get", "category"], ["literal", allowed]],
  ] as FilterSpecification;
}

/** Apply the current per-category visibility to both POI layers. Called
 *  from the reactive effect in MapView whenever `poiCategoryVisible`
 *  changes in the store. */
export function applyPoiCategoryFilter(m: MLMap): void {
  for (const group of ["critical", "huts"] as const) {
    const id = layerId(group);
    if (m.getLayer(id)) m.setFilter(id, buildFilter(group));
  }
}

/* Base radius (px) at z=12, modulated by per-feature importance and the
 * breathing wave below. Tuned to read as a soft glowing point at urban
 * zooms (10-13) without dominating the screen at low zoom. */
const BASE_RADIUS = 14;

/* Breathing animation:
 *   period 2400 ms, radius amplitude ±22 %, opacity amplitude ±18 %.
 *   Coupling radius + opacity gives a clear "inhale → bright + grow"
 *   beat instead of the subtler radius-only pulse the old three-tier
 *   stack used. */
const BREATH_PERIOD = 2400;
const BREATH_RADIUS_AMP = 0.22;
const BREATH_OPACITY_AMP = 0.18;
const BREATH_OPACITY_MEAN = 0.78;

/** Per-zoom radius scale (constant across breath); breath is a runtime
 *  multiplier applied via setPaintProperty. Keep `["zoom"]` as the
 *  outermost expression input — nesting it inside `*` is a style-spec
 *  validation error (the same trap the old code documented). */
function radiusExpr(scale: number): ExpressionSpecification {
  const base = BASE_RADIUS * scale;
  const importanceMult: ExpressionSpecification = [
    "+",
    0.55,
    ["/", ["coalesce", ["get", "importance"], 4], 4],
  ];
  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    6, ["*", importanceMult, base * 0.45],
    9, ["*", importanceMult, base * 0.75],
    12, ["*", importanceMult, base * 1.0],
    16, ["*", importanceMult, base * 1.35],
  ];
}

function addGroup(
  m: MLMap,
  group: "critical" | "huts",
  visible: boolean,
): void {
  const id = layerId(group);
  m.addLayer({
    id,
    type: "circle",
    source: POI_SOURCE,
    filter: buildFilter(group),
    layout: { visibility: visible ? "visible" : "none" },
    paint: {
      "circle-color": colorByCategory(),
      "circle-radius": radiusExpr(1.0),
      // Strong blur produces the gaussian fall-off so the dot reads as a
      // single soft point rather than a hard disc. Values >1 push the
      // center toward zero — 0.85 is the sweet spot where the centre
      // stays bright but the edges feather convincingly.
      "circle-blur": 0.85,
      "circle-opacity": BREATH_OPACITY_MEAN,
      "circle-pitch-alignment": "map",
    },
  });
}

let breathAnimationId: number | null = null;

function startBreathing(m: MLMap): void {
  if (breathAnimationId !== null) return;
  const startedAt = performance.now();
  const tick = (now: number) => {
    breathAnimationId = requestAnimationFrame(tick);
    for (const group of ["critical", "huts"] as const) {
      const id = layerId(group);
      if (!m.getLayer(id)) continue;
      const phase = (now - startedAt) / BREATH_PERIOD;
      const wave = Math.sin(phase * 2 * Math.PI);
      const radiusScale = 1 + BREATH_RADIUS_AMP * wave;
      const opacity = BREATH_OPACITY_MEAN + BREATH_OPACITY_AMP * wave;
      m.setPaintProperty(id, "circle-radius", radiusExpr(radiusScale));
      m.setPaintProperty(id, "circle-opacity", opacity);
    }
  };
  breathAnimationId = requestAnimationFrame(tick);
}

function stopBreathing(): void {
  if (breathAnimationId !== null) {
    cancelAnimationFrame(breathAnimationId);
    breathAnimationId = null;
  }
}

export function uninstallIconLoader(): void {
  // No SDF icons in this renderer; kept as a no-op for call-site
  // compatibility plus a hook to halt the breath loop on teardown.
  stopBreathing();
}

export function addCriticalPoi(
  m: MLMap,
  criticalVisible: boolean,
  hutsVisible: boolean,
): void {
  for (const group of ["critical", "huts"] as const) {
    const id = layerId(group);
    if (m.getLayer(id)) m.removeLayer(id);
  }
  if (m.getSource(POI_SOURCE)) m.removeSource(POI_SOURCE);

  m.addSource(POI_SOURCE, {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });

  addGroup(m, "critical", criticalVisible);
  addGroup(m, "huts", hutsVisible);

  void loadPoi().then((fc) => {
    const src = m.getSource(POI_SOURCE) as GeoJSONSource | undefined;
    src?.setData(fc);
  });

  startBreathing(m);
}

export function setCriticalVisible(m: MLMap, v: boolean): void {
  const id = layerId("critical");
  if (m.getLayer(id)) m.setLayoutProperty(id, "visibility", v ? "visible" : "none");
}

export function setHutsVisible(m: MLMap, v: boolean): void {
  const id = layerId("huts");
  if (m.getLayer(id)) m.setLayoutProperty(id, "visibility", v ? "visible" : "none");
}

export function applyPoiModel(): void {
  // No-op: gaussian points are coloured by category (constant per POI),
  // not by per-model risk. Kept for call-site compatibility — MapView
  // calls it on model change but there is nothing to update here.
}

/** Convenience for legend / tests — the canonical set of categories
 *  rendered per group. */
export const POI_GROUP_CATEGORIES: Record<"critical" | "huts", PoiCategory[]> = {
  critical: CRITICAL_CATEGORIES,
  huts: HUTS_CATEGORIES,
};

void POI_CATEGORIES; // keep types import live for tooling
