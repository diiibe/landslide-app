import type { Map as MLMap, GeoJSONSource } from "maplibre-gl";
import type {
  DataDrivenPropertyValueSpecification,
  ExpressionSpecification,
  FilterSpecification,
} from "@maplibre/maplibre-gl-style-spec";
import { useAppStore } from "@/app/store";
import { POI_DEFAULT_COLORS, type PoiCategory } from "@/app/types";
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
  // Read live from the store so user overrides in the PoiLegendPanel
  // take effect on the next addLayer or setPaintProperty call.
  const colors = useAppStore.getState().poiColors;
  // The strict tuple type for `match` is too narrow to accept a rest
  // spread of unknown length — cast through `unknown` once at the
  // boundary, the runtime expression is the standard MapLibre shape.
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

/** Push the current store palette into every live POI tier's
 *  `circle-color`. Cheap enough to run on every store change since
 *  there are only six layers. */
export function applyPoiColors(m: import("maplibre-gl").Map): void {
  for (const group of ["critical", "huts"] as const) {
    for (const tier of TIER_NAMES) {
      const id = layerId(group, tier);
      if (m.getLayer(id)) m.setPaintProperty(id, "circle-color", colorByCategory());
    }
  }
}

export type { PoiCategory };

const FILTER_CRITICAL: FilterSpecification = ["==", ["get", "group"], "critical"];
const FILTER_HUTS: FilterSpecification = ["==", ["get", "group"], "huts"];

/* Base radius (px) at z=11 per tier, before importance and breathing
   multipliers. Tuned so the three stacked circles read as a single soft
   bloom rather than as concentric rings. */
const BASE_RADIUS = {
  glow: 22,
  halo: 12,
  core: 4.5,
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

/** Build the per-tier `circle-radius` expression.
 *
 *  MapLibre constraint: `["zoom"]` may ONLY appear as the input to a
 *  TOP-LEVEL `step` or `interpolate`. Nesting it inside `*`, `+` or any
 *  other expression triggers a validation error and the whole layer is
 *  silently rejected — which is exactly how this layer disappeared in
 *  the first place. Keep `interpolate(["zoom"], …)` as the outermost
 *  expression and fold importance × base × scale into each stop. */
function radiusExpr(tier: Tier, scale: number): ExpressionSpecification {
  const base = BASE_RADIUS[tier] * scale;
  // Per-feature `importance` (typical range 1..5) maps to ~0.75..1.75 so
  // hospitals/large structures read bigger than minor schools.
  // `importance` defaults to 4 (=1.5×) for any feature missing it.
  const importanceMult: ExpressionSpecification = [
    "+",
    0.5,
    ["/", ["coalesce", ["get", "importance"], 4], 4],
  ];
  // Top-level zoom interpolate. Each stop is importance × base ×
  // zoomFactor — non-zoom expressions are allowed as stop values.
  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    6, ["*", importanceMult, base * 0.55],
    9, ["*", importanceMult, base * 0.85],
    12, ["*", importanceMult, base * 1.0],
    16, ["*", importanceMult, base * 1.3],
  ];
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
  // The core is bright and only lightly softened. circle-blur over ~1
  // is "fully blurred to the centerpoint" which makes the circle
  // perceptually invisible at small radii — keep it ≤ 0.9.
  const opacity = tier === "glow" ? 0.35 : tier === "halo" ? 0.7 : 1.0;
  const blur = tier === "glow" ? 0.9 : tier === "halo" ? 0.45 : 0.1;
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
