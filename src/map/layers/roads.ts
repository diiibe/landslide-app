import type { Map as MLMap, GeoJSONSource } from "maplibre-gl";
import { useAppStore } from "@/app/store";
import type { ModelId } from "@/app/types";
import {
  bakeRiskIntoFeatures,
  loadCellGrid,
  type CellGrid,
} from "./cellGrid";

/**
 * Roads overlay (risk-tinted).
 *
 * Two static datasets, both immutable across pan/zoom:
 *
 *   1. `cell_grid_<model>.json` — coarse 0.002° (~220 m) grid baked from
 *      the susceptibility centroids pmtiles. See `cellGrid.ts`.
 *   2. `roads_fvg.geojson` — FVG roads from OpenStreetMap (motorway →
 *      service). Identical geometry at every zoom — no Mapbox-style
 *      vector-tile generalization shifting vertices around.
 *
 * On model change we walk the FeatureCollection once, write `risk` into
 * each feature's properties, and `setData` the source. After that the
 * map never recomputes anything: the line-color expression resolves the
 * gradient from the static `risk` property, identically at every zoom.
 *
 * Sensitivity is baked into the line-color expression (not the data) so
 * the slider is instant — `setPaintProperty` only.
 */

export const ROADS_SOURCE = "roads-static";
export const ROADS_LAYER = "roads-overlay";
export const ROADS_HALO = "roads-overlay-halo";
export const ROADS_GLOW = "roads-overlay-glow";

const DATA_URL_KEY = "roads_fvg.geojson";

// Sensitivity is applied *inside* the expression input (not by pre-scaling
// the stops). Pre-scaling collapses multiple stops to 1 when sens > 1,
// which breaks the strict-ascending requirement of `interpolate`.
function scaledRisk(sens: number): unknown {
  return ["min", 1, ["*", sens, ["coalesce", ["get", "risk"], 0]]];
}

function riskColor(sens: number): unknown {
  return [
    "interpolate", ["linear"], scaledRisk(sens),
    0.00, "#22D3FF",
    0.08, "#9FD9D2",
    0.20, "#FFD17A",
    0.35, "#FF9445",
    0.55, "#EE3E2C",
    0.80, "#A40E18",
    1.00, "#580712",
  ];
}

function riskGlow(sens: number): unknown {
  return [
    "interpolate", ["linear"], scaledRisk(sens),
    0.00, "#38BDF8",
    0.20, "#FFC85C",
    0.45, "#F26430",
    0.70, "#C81720",
    1.00, "#7A0A12",
  ];
}

let activeGridModel: ModelId | null = null;
let roadsRaw: GeoJSON.FeatureCollection | null = null;
let roadsInFlight: Promise<GeoJSON.FeatureCollection> | null = null;

async function loadRoads(): Promise<GeoJSON.FeatureCollection> {
  if (roadsRaw) return roadsRaw;
  if (!roadsInFlight) {
    roadsInFlight = (async () => {
      const url = `${import.meta.env.BASE_URL}data/${DATA_URL_KEY}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${DATA_URL_KEY}: ${res.status}`);
      return (await res.json()) as GeoJSON.FeatureCollection;
    })();
  }
  roadsRaw = await roadsInFlight;
  return roadsRaw;
}

let bakingPromise: Promise<void> | null = null;

async function refreshRoadData(m: MLMap, model: ModelId): Promise<void> {
  if (bakingPromise) await bakingPromise;
  bakingPromise = (async () => {
    const [grid, roads]: [CellGrid, GeoJSON.FeatureCollection] = await Promise.all([
      loadCellGrid(model),
      loadRoads(),
    ]);
    activeGridModel = model;
    const params = useAppStore.getState().riskParams.roads[model];
    const baked = bakeRiskIntoFeatures(roads, grid, {
      gamma: params.gamma,
      radius: params.radius,
    });
    const src = m.getSource(ROADS_SOURCE) as GeoJSONSource | undefined;
    src?.setData(baked);
  })();
  await bakingPromise;
  bakingPromise = null;
}

export function addRoads(m: MLMap, visible: boolean, dark: boolean): void {
  for (const id of [ROADS_LAYER, ROADS_HALO, ROADS_GLOW]) {
    if (m.getLayer(id)) m.removeLayer(id);
  }
  if (m.getSource(ROADS_SOURCE)) m.removeSource(ROADS_SOURCE);

  m.addSource(ROADS_SOURCE, {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });

  const st = useAppStore.getState();
  const sens = st.riskParams.roads[st.model].sensitivity;
  const haloOpacity = dark ? 0.85 : 0.7;
  const outerOpacity = dark ? 0.6 : 0.45;

  m.addLayer({
    id: ROADS_GLOW,
    type: "line",
    source: ROADS_SOURCE,
    paint: {
      "line-color": riskGlow(sens) as never,
      "line-opacity": outerOpacity,
      "line-blur": 16,
      "line-width": 24,
    },
    layout: {
      visibility: visible ? "visible" : "none",
      "line-cap": "round",
      "line-join": "round",
    },
  });

  m.addLayer({
    id: ROADS_HALO,
    type: "line",
    source: ROADS_SOURCE,
    paint: {
      "line-color": riskGlow(sens) as never,
      "line-opacity": haloOpacity,
      "line-blur": 8,
      "line-width": 10,
    },
    layout: {
      visibility: visible ? "visible" : "none",
      "line-cap": "round",
      "line-join": "round",
    },
  });

  m.addLayer({
    id: ROADS_LAYER,
    type: "line",
    source: ROADS_SOURCE,
    paint: {
      "line-color": riskColor(sens) as never,
      "line-opacity": 1.0,
      "line-width": 2.5,
    },
    layout: {
      visibility: visible ? "visible" : "none",
      "line-cap": "round",
      "line-join": "round",
    },
  });

  void refreshRoadData(m, useAppStore.getState().model);
}

export function setRoadsVisible(m: MLMap, v: boolean): void {
  for (const id of [ROADS_GLOW, ROADS_HALO, ROADS_LAYER]) {
    if (m.getLayer(id)) m.setLayoutProperty(id, "visibility", v ? "visible" : "none");
  }
}

export function rebakeRoads(m: MLMap): void {
  void refreshRoadData(m, useAppStore.getState().model);
}

export function applyRoadSensitivity(m: MLMap): void {
  if (!m.getLayer(ROADS_LAYER)) return;
  const st = useAppStore.getState();
  const sens = st.riskParams.roads[st.model].sensitivity;
  m.setPaintProperty(ROADS_LAYER, "line-color", riskColor(sens) as never);
  m.setPaintProperty(ROADS_HALO, "line-color", riskGlow(sens) as never);
  m.setPaintProperty(ROADS_GLOW, "line-color", riskGlow(sens) as never);
}

// Kept exported for backwards compatibility with MapView call sites that
// were written for the previous (vector-tile-based) implementation. Both
// are no-ops now that the source is fully static.
export function tintRoadsByRisk(m: MLMap): void {
  const wanted = useAppStore.getState().model;
  if (wanted !== activeGridModel) void refreshRoadData(m, wanted);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function installRoadTinting(_: MLMap): void {
  // No idle-driven retinting: data is static. Kept exported for legacy
  // call sites in MapView; remove once those are dropped.
}
