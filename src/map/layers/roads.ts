import type { Map as MLMap, GeoJSONSource } from "maplibre-gl";
import type { ExpressionSpecification } from "@maplibre/maplibre-gl-style-spec";
import { useAppStore } from "@/app/store";
import type { ModelId } from "@/app/types";
import {
  bakeRiskIntoFeatures,
  loadCellGrid,
  type CellGrid,
} from "./cellGrid";
import { RoadsFeatureCollectionSchema, parseOrThrow } from "@/lib/schemas";

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
function scaledRisk(sens: number): ExpressionSpecification {
  return ["min", 1, ["*", sens, ["coalesce", ["get", "risk"], 0]]];
}

function riskColor(sens: number): ExpressionSpecification {
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

function riskGlow(sens: number): ExpressionSpecification {
  return [
    "interpolate", ["linear"], scaledRisk(sens),
    0.00, "#38BDF8",
    0.20, "#FFC85C",
    0.45, "#F26430",
    0.70, "#C81720",
    1.00, "#7A0A12",
  ];
}

let roadsRaw: GeoJSON.FeatureCollection | null = null;
let roadsInFlight: Promise<GeoJSON.FeatureCollection> | null = null;

async function loadRoads(): Promise<GeoJSON.FeatureCollection> {
  if (roadsRaw) return roadsRaw;
  if (!roadsInFlight) {
    roadsInFlight = (async () => {
      const url = `${import.meta.env.BASE_URL}data/${DATA_URL_KEY}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${DATA_URL_KEY}: ${res.status}`);
      const json: unknown = await res.json();
      const validated = parseOrThrow(RoadsFeatureCollectionSchema, json, DATA_URL_KEY);
      return validated as GeoJSON.FeatureCollection;
    })();
  }
  roadsRaw = await roadsInFlight;
  return roadsRaw;
}

/** Bake roads in chunks of CHUNK_SIZE features, yielding to the event loop
 *  between chunks. `bakeRiskIntoFeatures` over the full ~tens-of-thousands
 *  road network with radius=8 is ~290M point ops — synchronous walk freezes
 *  the UI for seconds. Chunking + setTimeout(0) keeps frames responsive
 *  (P0.4). The cellGrid baker itself is sync, so we shard the input and
 *  concatenate the per-chunk outputs. */
const CHUNK_SIZE = 2000;

async function bakeChunked(
  fc: GeoJSON.FeatureCollection,
  grid: CellGrid,
  opts: { gamma: number; radius: number },
): Promise<GeoJSON.FeatureCollection> {
  const total = fc.features.length;
  if (total <= CHUNK_SIZE) return bakeRiskIntoFeatures(fc, grid, opts);
  const out: GeoJSON.Feature[] = [];
  for (let i = 0; i < total; i += CHUNK_SIZE) {
    const slice: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: fc.features.slice(i, i + CHUNK_SIZE),
    };
    const baked = bakeRiskIntoFeatures(slice, grid, opts);
    for (const f of baked.features) out.push(f);
    // Yield to the event loop so the main thread can render frames /
    // process input between chunks. setTimeout(0) is enough — we just
    // need any macrotask boundary.
    await new Promise((r) => setTimeout(r, 0));
  }
  return { type: "FeatureCollection", features: out };
}

/** Single source of truth for the actual bake. Exported as `_bakeForTest`
 *  below so the coalesce test can mock it. */
async function doBake(m: MLMap, model: ModelId): Promise<void> {
  const [grid, roads]: [CellGrid, GeoJSON.FeatureCollection] = await Promise.all([
    loadCellGrid(model),
    loadRoads(),
  ]);
  const params = useAppStore.getState().riskParams.roads[model];
  const baked = await bakeChunked(roads, grid, {
    gamma: params.gamma,
    radius: params.radius,
  });
  const src = m.getSource(ROADS_SOURCE) as GeoJSONSource | undefined;
  src?.setData(baked);
}

// Coalesce overlapping refresh requests with a single pending slot. The
// previous queue-everything pattern (await bakingPromise; then run) meant
// 5 rapid slider drags ran 5 bakes back-to-back, even though only the
// last params matter. The pending slot overwrites stale requests so we
// run at most twice: once in-flight, once with the latest params (P0.5).
let inflight: Promise<void> | null = null;
let pending: { model: ModelId } | null = null;
// Indirection so tests can swap the per-call bake implementation.
let bakeImpl: (m: MLMap, model: ModelId) => Promise<void> = doBake;

async function refreshRoadData(m: MLMap, model: ModelId): Promise<void> {
  if (inflight) {
    pending = { model };
    return inflight;
  }
  inflight = (async () => {
    try {
      await bakeImpl(m, model);
      while (pending) {
        const next = pending;
        pending = null;
        await bakeImpl(m, next.model);
      }
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

// Test-only hook: swap the bake fn and reset the coalesce state. Not part
// of the public API; exists so `roads.test.ts` can assert P0.5 behavior
// without spinning up a real MapLibre instance.
export const __test = {
  setBakeImpl(fn: (m: MLMap, model: ModelId) => Promise<void>): void {
    bakeImpl = fn;
  },
  reset(): void {
    bakeImpl = doBake;
    inflight = null;
    pending = null;
  },
  refresh: refreshRoadData,
};

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
      "line-color": riskGlow(sens),
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
      "line-color": riskGlow(sens),
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
      "line-color": riskColor(sens),
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
  m.setPaintProperty(ROADS_LAYER, "line-color", riskColor(sens));
  m.setPaintProperty(ROADS_HALO, "line-color", riskGlow(sens));
  m.setPaintProperty(ROADS_GLOW, "line-color", riskGlow(sens));
}
