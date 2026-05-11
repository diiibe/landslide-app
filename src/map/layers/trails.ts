import type { Map as MLMap, GeoJSONSource } from "maplibre-gl";
import type { ExpressionSpecification } from "@maplibre/maplibre-gl-style-spec";
import { useAppStore } from "@/app/store";
import type { ModelId } from "@/app/types";
import {
  bakeRiskIntoFeatures,
  loadCellGrid,
  type CellGrid,
} from "./cellGrid";
import { TrailsFeatureCollectionSchema, parseOrThrow } from "@/lib/schemas";

/**
 * Trails overlay (risk-tinted) — sentieri / mulattiere / piste.
 *
 * Same architecture as `roads.ts` (static GeoJSON, baked-once risk per
 * feature, sensitivity-only paint updates). Different visual identity:
 *
 *   - thinner dashed stroke so it doesn't compete with roads;
 *   - baseline color is forest-green instead of cyan, so a "safe" trail
 *     doesn't read as a road;
 *   - same red apex when risk is high, so the user reads risk uniformly.
 */

export const TRAILS_SOURCE = "trails-static";
export const TRAILS_LAYER = "trails-overlay";
export const TRAILS_HALO = "trails-overlay-halo";
export const TRAILS_GLOW = "trails-overlay-glow";

const DATA_URL_KEY = "trails_fvg.geojson";

function scaledRisk(sens: number): ExpressionSpecification {
  return ["min", 1, ["*", sens, ["coalesce", ["get", "risk"], 0]]];
}

function trailColor(sens: number): ExpressionSpecification {
  return [
    "interpolate", ["linear"], scaledRisk(sens),
    0.00, "#7BAF8A", // forest green — safe trail
    0.10, "#C9C076",
    0.25, "#FFD17A",
    0.40, "#FF9445",
    0.60, "#EE3E2C",
    0.85, "#A40E18",
    1.00, "#580712",
  ];
}

function trailGlow(sens: number): ExpressionSpecification {
  return [
    "interpolate", ["linear"], scaledRisk(sens),
    0.00, "#7BAF8A",
    0.25, "#FFC85C",
    0.50, "#F26430",
    0.75, "#C81720",
    1.00, "#7A0A12",
  ];
}

let trailsRaw: GeoJSON.FeatureCollection | null = null;
let trailsInFlight: Promise<GeoJSON.FeatureCollection> | null = null;

async function loadTrails(): Promise<GeoJSON.FeatureCollection> {
  if (trailsRaw) return trailsRaw;
  if (!trailsInFlight) {
    trailsInFlight = (async () => {
      const url = `${import.meta.env.BASE_URL}data/${DATA_URL_KEY}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${DATA_URL_KEY}: ${res.status}`);
      const json: unknown = await res.json();
      const validated = parseOrThrow(TrailsFeatureCollectionSchema, json, DATA_URL_KEY);
      return validated as GeoJSON.FeatureCollection;
    })();
  }
  trailsRaw = await trailsInFlight;
  return trailsRaw;
}

let bakingPromise: Promise<void> | null = null;

async function refreshTrailData(m: MLMap, model: ModelId): Promise<void> {
  if (bakingPromise) await bakingPromise;
  bakingPromise = (async () => {
    const [grid, trails]: [CellGrid, GeoJSON.FeatureCollection] = await Promise.all([
      loadCellGrid(model),
      loadTrails(),
    ]);
    const params = useAppStore.getState().riskParams.trails[model];
    const baked = bakeRiskIntoFeatures(trails, grid, {
      gamma: params.gamma,
      radius: params.radius,
    });
    const src = m.getSource(TRAILS_SOURCE) as GeoJSONSource | undefined;
    src?.setData(baked);
  })();
  await bakingPromise;
  bakingPromise = null;
}

export function addTrails(m: MLMap, visible: boolean, dark: boolean): void {
  for (const id of [TRAILS_LAYER, TRAILS_HALO, TRAILS_GLOW]) {
    if (m.getLayer(id)) m.removeLayer(id);
  }
  if (m.getSource(TRAILS_SOURCE)) m.removeSource(TRAILS_SOURCE);

  m.addSource(TRAILS_SOURCE, {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });

  const st = useAppStore.getState();
  const sens = st.riskParams.trails[st.model].sensitivity;
  const haloOpacity = dark ? 0.7 : 0.55;
  const outerOpacity = dark ? 0.45 : 0.3;

  // Outer glow — softer + narrower than roads (trails are thinner).
  m.addLayer({
    id: TRAILS_GLOW,
    type: "line",
    source: TRAILS_SOURCE,
    paint: {
      "line-color": trailGlow(sens),
      "line-opacity": outerOpacity,
      "line-blur": 10,
      "line-width": 14,
    },
    layout: {
      visibility: visible ? "visible" : "none",
      "line-cap": "round",
      "line-join": "round",
    },
  });

  // Inner halo.
  m.addLayer({
    id: TRAILS_HALO,
    type: "line",
    source: TRAILS_SOURCE,
    paint: {
      "line-color": trailGlow(sens),
      "line-opacity": haloOpacity,
      "line-blur": 5,
      "line-width": 6,
    },
    layout: {
      visibility: visible ? "visible" : "none",
      "line-cap": "round",
      "line-join": "round",
    },
  });

  // Dashed stroke — distinguishes trails from roads at a glance.
  m.addLayer({
    id: TRAILS_LAYER,
    type: "line",
    source: TRAILS_SOURCE,
    paint: {
      "line-color": trailColor(sens),
      "line-opacity": 1.0,
      "line-width": 1.6,
      "line-dasharray": [2, 1.6],
    },
    layout: {
      visibility: visible ? "visible" : "none",
      "line-cap": "butt",
      "line-join": "round",
    },
  });

  void refreshTrailData(m, useAppStore.getState().model);
}

export function setTrailsVisible(m: MLMap, v: boolean): void {
  for (const id of [TRAILS_GLOW, TRAILS_HALO, TRAILS_LAYER]) {
    if (m.getLayer(id)) m.setLayoutProperty(id, "visibility", v ? "visible" : "none");
  }
}

export function rebakeTrails(m: MLMap): void {
  void refreshTrailData(m, useAppStore.getState().model);
}

export function applyTrailSensitivity(m: MLMap): void {
  if (!m.getLayer(TRAILS_LAYER)) return;
  const st = useAppStore.getState();
  const sens = st.riskParams.trails[st.model].sensitivity;
  m.setPaintProperty(TRAILS_LAYER, "line-color", trailColor(sens));
  m.setPaintProperty(TRAILS_HALO, "line-color", trailGlow(sens));
  m.setPaintProperty(TRAILS_GLOW, "line-color", trailGlow(sens));
}
