/**
 * Polygon-drawing tool: thin wrapper around terra-draw + its MapLibre
 * adapter. We use a single TerraDrawPolygonMode so vertices are placed
 * with single taps and the polygon is closed by double-tapping the
 * last vertex (or right-click on desktop).
 *
 * Lifecycle:
 *   1. `startDrawing(m)` starts the tool. The DrawingPanel mounts on
 *      `drawingMode === true` and renders the live preview.
 *   2. Every vertex change emits a `DrawingPreview` to subscribers so
 *      the panel can show vertex count and the running area.
 *   3. When terra-draw's `finish` event fires (double-tap close), the
 *      preview transitions to `phase: "ready"` and the user gets a
 *      Save/Discard form. There is no more window.prompt; commit is
 *      driven by the panel.
 */

import type { Map as MLMap } from "maplibre-gl";
import type { TerraDraw } from "terra-draw";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point } from "@turf/helpers";
import turfBbox from "@turf/bbox";
import turfArea from "@turf/area";
import type { UserPolygonStats } from "@/app/types";
import { useAppStore } from "@/app/store";
import { SUSCEPT_LAYER } from "./layers/susceptibility";
import { IFFI_FILL } from "./layers/iffi";

type DrawFeature = {
  id: string | number;
  type: "Feature";
  properties: Record<string, unknown> & { mode?: string };
  geometry: GeoJSON.Geometry;
};

export interface DrawingPreview {
  /** `drawing`: the user is still placing vertices; `ready`: terra-draw
   *  closed the polygon and is waiting for a Save/Discard decision. */
  phase: "drawing" | "ready";
  vertexCount: number;
  /** Area in km² of the current polygon ring. 0 until ≥ 3 vertices. */
  areaKm2: number;
  /** Closed polygon geometry, present once `phase === "ready"`. */
  geometry?: GeoJSON.Polygon;
}

type Listener = (p: DrawingPreview) => void;
const listeners = new Set<Listener>();

let active: TerraDraw | null = null;
let mapRef: MLMap | null = null;
/** terra-draw feature id of the polygon currently being committed. Set
 *  in the `finish` handler so commitDrawing knows which polygon to
 *  persist if the user has started another after closing the first. */
let readyFeatureId: string | number | null = null;

function publish(p: DrawingPreview): void {
  for (const fn of listeners) {
    try {
      fn(p);
    } catch {
      // listeners are UI handlers; a throw inside one shouldn't kill
      // the others.
    }
  }
}

function readPreview(phase: "drawing" | "ready"): DrawingPreview {
  if (!active) return { phase, vertexCount: 0, areaKm2: 0 };
  const feats = active.getSnapshot() as DrawFeature[];
  const open = feats.find((f) => f.properties?.mode === "polygon");
  const closed = feats.find((f) => f.id === readyFeatureId);
  const target = phase === "ready" ? closed : open ?? closed;
  if (!target || target.geometry.type !== "Polygon") {
    return { phase, vertexCount: 0, areaKm2: 0 };
  }
  const ring = target.geometry.coordinates[0] ?? [];
  // terra-draw closes the ring by repeating the first vertex; the user-
  // facing count subtracts that duplicate so "3 points" reads naturally.
  const vertexCount = Math.max(0, ring.length - (phase === "ready" ? 1 : 0));
  const areaKm2 = ring.length >= 3 ? turfArea(target as never) / 1_000_000 : 0;
  const preview: DrawingPreview = { phase, vertexCount, areaKm2 };
  if (phase === "ready") preview.geometry = target.geometry;
  return preview;
}

/** Start drawing. Re-entrant: calling twice replaces the previous tool.
 *  terra-draw + its MapLibre adapter are lazy-imported so vitest's
 *  jsdom integration tests — which `vi.mock` the whole MapView away —
 *  don't have to resolve the adapter's CJS/ESM interop. */
export async function startDrawing(m: MLMap): Promise<void> {
  stopDrawing();
  mapRef = m;
  readyFeatureId = null;

  const [{ TerraDraw, TerraDrawPolygonMode }, { TerraDrawMapLibreGLAdapter }] =
    await Promise.all([
      import("terra-draw"),
      import("terra-draw-maplibre-gl-adapter"),
    ]);

  // Race: if the user toggled drawing off again while the adapter was
  // resolving, bail without registering anything.
  if (!useAppStore.getState().drawingMode) return;

  const draw = new TerraDraw({
    adapter: new TerraDrawMapLibreGLAdapter({ map: m as unknown as never }),
    modes: [new TerraDrawPolygonMode()],
  });
  draw.start();
  draw.setMode("polygon");
  active = draw;
  publish({ phase: "drawing", vertexCount: 0, areaKm2: 0 });

  draw.on("change", () => {
    if (!active) return;
    if (readyFeatureId === null) publish(readPreview("drawing"));
  });

  draw.on("finish", (id) => {
    readyFeatureId = id;
    publish(readPreview("ready"));
  });
}

export function stopDrawing(): void {
  if (active) {
    try {
      active.stop();
    } catch {
      // already stopped
    }
    active = null;
  }
  mapRef = null;
  readyFeatureId = null;
  publish({ phase: "drawing", vertexCount: 0, areaKm2: 0 });
}

export function subscribeDrawingPreview(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Commit the closed polygon to the store with the user-chosen name and
 *  optional colour. Returns true on success. */
export function commitDrawing(name: string, color?: string): boolean {
  if (!active || !mapRef || readyFeatureId === null) return false;
  const feats = active.getSnapshot() as DrawFeature[];
  const feature = feats.find((f) => f.id === readyFeatureId);
  if (!feature || feature.geometry.type !== "Polygon") return false;
  const geom = feature.geometry;
  const stats = computeStatsForPolygon(mapRef, geom);
  const bbox = turfBbox({
    type: "Feature",
    properties: {},
    geometry: geom,
  } as GeoJSON.Feature<GeoJSON.Polygon>);
  const bounds: [[number, number], [number, number]] = [
    [bbox[0]!, bbox[1]!],
    [bbox[2]!, bbox[3]!],
  ];
  const trimmed = name.trim() || `Area ${useAppStore.getState().userPolygons.length + 1}`;
  useAppStore.getState().addUserPolygon({
    name: trimmed,
    geometry: geom,
    bounds,
    stats,
    ...(color ? { color } : {}),
  });
  stopDrawing();
  useAppStore.getState().setDrawingMode(false);
  return true;
}

/** Discard the current closed polygon and exit drawing mode. */
export function cancelDrawing(): void {
  stopDrawing();
  useAppStore.getState().setDrawingMode(false);
}

export function isDrawing(): boolean {
  return active !== null;
}

/** Stats sampled from the currently-rendered map state for a polygon
 *  closed via terra-draw. */
function computeStatsForPolygon(
  m: MLMap,
  polygon: GeoJSON.Polygon,
): UserPolygonStats {
  const polyFeature: GeoJSON.Feature<GeoJSON.Polygon> = {
    type: "Feature",
    properties: {},
    geometry: polygon,
  };
  const areaKm2 = turfArea(polyFeature) / 1_000_000;
  const state = useAppStore.getState();
  const threshold = state.threshold;
  const model = state.model;

  const cellFeats = m.getLayer(SUSCEPT_LAYER)
    ? m.queryRenderedFeatures({ layers: [SUSCEPT_LAYER] })
    : [];
  const iffiFeats = m.getLayer(IFFI_FILL)
    ? m.queryRenderedFeatures({ layers: [IFFI_FILL] })
    : [];

  let cellsVisible = 0;
  let cellsAboveThreshold = 0;
  let pSum = 0;
  const pVals: number[] = [];
  const seenCells = new Set<string | number>();
  for (const f of cellFeats) {
    const cellId = f.properties?.cell_id as number | string | undefined;
    if (cellId !== undefined) {
      if (seenCells.has(cellId)) continue;
      seenCells.add(cellId);
    }
    const c = featureCentroid(f.geometry as GeoJSON.Geometry);
    if (!c) continue;
    if (!booleanPointInPolygon(point(c), polyFeature)) continue;
    cellsVisible++;
    const p = Number(f.properties?.p ?? 0);
    pSum += p;
    pVals.push(p);
    if (p >= threshold) cellsAboveThreshold++;
  }
  const meanP = cellsVisible > 0 ? pSum / cellsVisible : 0;
  pVals.sort((a, b) => a - b);
  const medianP =
    pVals.length === 0
      ? 0
      : pVals.length % 2 === 1
        ? pVals[(pVals.length - 1) / 2]!
        : (pVals[pVals.length / 2 - 1]! + pVals[pVals.length / 2]!) / 2;

  let iffiCount = 0;
  const seenIffi = new Set<string | number>();
  for (const f of iffiFeats) {
    const fid = f.properties?.id_frana as string | number | undefined;
    if (fid !== undefined) {
      if (seenIffi.has(fid)) continue;
      seenIffi.add(fid);
    }
    const c = featureCentroid(f.geometry as GeoJSON.Geometry);
    if (!c) continue;
    if (booleanPointInPolygon(point(c), polyFeature)) iffiCount++;
  }

  return {
    areaKm2,
    cellsVisible,
    cellsAboveThreshold,
    meanP,
    medianP,
    iffiCount,
    threshold,
    model,
  };
}

function featureCentroid(g: GeoJSON.Geometry): [number, number] | null {
  if (g.type === "Point") {
    const c = g.coordinates;
    return [c[0]!, c[1]!];
  }
  if (g.type === "Polygon") {
    const ring = g.coordinates[0];
    if (!ring || ring.length === 0) return null;
    let sx = 0;
    let sy = 0;
    for (const c of ring) {
      sx += c[0]!;
      sy += c[1]!;
    }
    return [sx / ring.length, sy / ring.length];
  }
  if (g.type === "MultiPolygon") {
    const first = g.coordinates[0]?.[0];
    if (!first || first.length === 0) return null;
    let sx = 0;
    let sy = 0;
    for (const c of first) {
      sx += c[0]!;
      sy += c[1]!;
    }
    return [sx / first.length, sy / first.length];
  }
  return null;
}
