import type { Map as MLMap, GeoJSONSource } from "maplibre-gl";
import type {
  DataDrivenPropertyValueSpecification,
  ExpressionSpecification,
  FilterSpecification,
} from "@maplibre/maplibre-gl-style-spec";
import { CriticalPoiFeatureCollectionSchema, parseOrThrow } from "@/lib/schemas";

/**
 * Critical structures + alpine huts overlay rendered as luminous,
 * breathing gaussian balls coloured by category. Each POI emits three
 * stacked circle layers:
 *
 *   • Outer glow  — large radius, low opacity, high `circle-blur` → soft halo
 *   • Mid halo    — medium radius, medium opacity, medium blur
 *   • Bright core — small radius, ~full opacity, slight blur
 *
 * The radii pulse via a requestAnimationFrame loop that drives a single
 * scalar multiplier on `circle-radius` for the three tiers (one
 * setPaintProperty per layer per frame — fine for the ~250 FVG POIs).
 * Colour is data-driven from the feature's `category` so hospitals,
 * fire stations, police, schools, alpine huts and wilderness huts each
 * have their own hue regardless of risk model.
 */

export const POI_SOURCE = "poi-static";
const TIER_NAMES = ["glow", "halo", "core"] as const;
type Tier = (typeof TIER_NAMES)[number];

function layerId(group: "critical" | "huts", tier: Tier): string {
  return `poi-${group}-${tier}`;
}
export const POI_CRITICAL = layerId("critical", "halo"); // exported for layer-anchor lookup
export const POI_HUTS = layerId("huts", "halo");

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

/** Per-category colour ramp. Picked so each category reads at a glance
 *  on both light and dark basemaps; no two categories share a hue. */
function colorByCategory(): DataDrivenPropertyValueSpecification<string> {
  return [
    "match",
    ["get", "category"],
    "hospital", "#FF3D5A",
    "fire_station", "#FF7A1F",
    "police", "#3F8CFF",
    "school", "#FFD400",
    "alpine_hut", "#2FCB6E",
    "wilderness_hut", "#00E0D6",
    /* default */ "#FFD400",
  ];
}

const FILTER_CRITICAL: FilterSpecification = ["==", ["get", "group"], "critical"];
const FILTER_HUTS: FilterSpecification = ["==", ["get", "group"], "huts"];

/* Base radius (px) at z=11 per tier, before importance and breathing
   multipliers. Tuned so the three stacked circles read as a single soft
   bloom rather than as concentric rings. */
const BASE_RADIUS = {
  glow: 26,
  halo: 14,
  core: 5,
} as const;

/* Breathing animation:
 *   period: 2400 ms per inhale-exhale
 *   amplitude: ±18 % around the base radius
 *   tier offset: ±200 ms so the glow leads, then the halo, then the core
 * The animation runs as long as at least one POI layer is visible. */
const BREATH_PERIOD = 2400;
const BREATH_AMPLITUDE = 0.18;
const TIER_PHASE_OFFSET: Record<Tier, number> = {
  glow: 0,
  halo: 200,
  core: 400,
};

/** Build the per-tier `circle-radius` expression. Per-feature `importance`
 *  (typical range 1–5) scales every tier so hospitals/large structures
 *  read bigger than minor schools. `scale` is the global breathing
 *  multiplier set via setPaintProperty every frame. */
function radiusExpr(tier: Tier, scale: number): ExpressionSpecification {
  const base = BASE_RADIUS[tier] * scale;
  // The product (importance / 4 + 0.5) maps importance 1..5 to ~0.75..1.75
  // — a gentle, non-linear scaling. importance defaults to 4 (=1.5×).
  const importanceMult: ExpressionSpecification = [
    "+",
    0.5,
    ["/", ["coalesce", ["get", "importance"], 4], 4],
  ];
  // Zoom factor: shrink at very low zoom so the glows don't overwhelm
  // the regional view.
  const zoomMult: ExpressionSpecification = [
    "interpolate",
    ["linear"],
    ["zoom"],
    6, 0.55,
    9, 0.85,
    12, 1.0,
    16, 1.3,
  ];
  return ["*", importanceMult, zoomMult, base];
}

function addTier(
  m: MLMap,
  group: "critical" | "huts",
  tier: Tier,
  filter: FilterSpecification,
  visible: boolean,
): void {
  const id = layerId(group, tier);
  // Outer tiers get more blur (gaussian fall-off) and lower opacity.
  // The core is bright and only lightly softened.
  const opacity = tier === "glow" ? 0.22 : tier === "halo" ? 0.55 : 0.95;
  const blur = tier === "glow" ? 1.4 : tier === "halo" ? 0.7 : 0.15;
  m.addLayer({
    id,
    type: "circle",
    source: POI_SOURCE,
    filter,
    layout: { visibility: visible ? "visible" : "none" },
    paint: {
      "circle-color": colorByCategory(),
      "circle-radius": radiusExpr(tier, 1.0),
      "circle-opacity": opacity,
      "circle-blur": blur,
      "circle-pitch-alignment": "map",
    },
  });
}

/* The animation handle is module-scoped because there is at most one
 * map at a time and the loop is owned by the layer module rather than
 * by React. Stored so we can cancel it cleanly on teardown. */
let breathAnimationId: number | null = null;

function startBreathing(m: MLMap): void {
  if (breathAnimationId !== null) return;
  const startedAt = performance.now();
  const tick = (now: number) => {
    breathAnimationId = requestAnimationFrame(tick);
    // Bail out (without cancelling — next visibility flip would re-start
    // us) when no layer is around any more.
    for (const group of ["critical", "huts"] as const) {
      for (const tier of TIER_NAMES) {
        const id = layerId(group, tier);
        if (!m.getLayer(id)) continue;
        const phase =
          (now - startedAt + TIER_PHASE_OFFSET[tier]) / BREATH_PERIOD;
        const wave = Math.sin(phase * 2 * Math.PI);
        const scale = 1 + BREATH_AMPLITUDE * wave;
        m.setPaintProperty(id, "circle-radius", radiusExpr(tier, scale));
      }
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
  // Kept exported because MapView still calls it on unmount. The
  // gaussian-balls renderer no longer needs an SDF image loader, so
  // this is now a no-op that also stops the breathing animation.
  stopBreathing();
}

export function addCriticalPoi(
  m: MLMap,
  criticalVisible: boolean,
  hutsVisible: boolean,
): void {
  for (const group of ["critical", "huts"] as const) {
    for (const tier of TIER_NAMES) {
      const id = layerId(group, tier);
      if (m.getLayer(id)) m.removeLayer(id);
    }
  }
  if (m.getSource(POI_SOURCE)) m.removeSource(POI_SOURCE);

  m.addSource(POI_SOURCE, {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });

  // Order matters: glow first so it sits underneath the halo, then the
  // core lights on top. Drawing tiers per group in this order keeps the
  // visual stack consistent even if a group gets toggled off later.
  for (const tier of TIER_NAMES) {
    addTier(m, "critical", tier, FILTER_CRITICAL, criticalVisible);
  }
  for (const tier of TIER_NAMES) {
    addTier(m, "huts", tier, FILTER_HUTS, hutsVisible);
  }

  void loadPoi().then((fc) => {
    const src = m.getSource(POI_SOURCE) as GeoJSONSource | undefined;
    src?.setData(fc);
  });

  // Always start the breathing — visibility is handled by the layer
  // visibility flag, but if neither group is visible the loop is a
  // few microseconds per frame of no-ops.
  startBreathing(m);
}

export function setCriticalVisible(m: MLMap, v: boolean): void {
  for (const tier of TIER_NAMES) {
    const id = layerId("critical", tier);
    if (m.getLayer(id)) m.setLayoutProperty(id, "visibility", v ? "visible" : "none");
  }
}

export function setHutsVisible(m: MLMap, v: boolean): void {
  for (const tier of TIER_NAMES) {
    const id = layerId("huts", tier);
    if (m.getLayer(id)) m.setLayoutProperty(id, "visibility", v ? "visible" : "none");
  }
}

export function applyPoiModel(): void {
  // No-op: gaussian balls are coloured by category (constant per POI),
  // not by per-model risk. Kept for call-site compatibility — MapView
  // calls it on model change but there is nothing to update here.
}
