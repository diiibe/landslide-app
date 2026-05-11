/**
 * Polygon-drawing tool: thin wrapper around terra-draw + its MapLibre
 * adapter. We use a single TerraDrawPolygonMode so vertices are placed
 * with single taps and the polygon is closed by double-tapping the
 * last vertex (or right-click on desktop).
 *
 * On `finish`, the freshly-drawn polygon's geometry is read out of
 * terra-draw, statistics are computed against the current map state
 * (susceptibility cells inside, IFFI count, area), the polygon is
 * persisted via the store's addUserPolygon, and the tool deactivates.
 */

import type { Map as MLMap } from "maplibre-gl";
import { TerraDraw, TerraDrawPolygonMode } from "terra-draw";
import { TerraDrawMapLibreGLAdapter } from "terra-draw-maplibre-gl-adapter";
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

let active: TerraDraw | null = null;
let onFinishOnce: ((id: string | number) => void) | null = null;

/** Start drawing. Returns immediately; the polygon is delivered async
 *  via the `fvg:polygon-drawn` window event with the freshly-built stats
 *  and bounds. Re-entrant: calling twice replaces the previous instance. */
export function startDrawing(m: MLMap): void {
  stopDrawing();

  // terra-draw-maplibre-gl-adapter ships its own MapLibre type; ours is
  // the same runtime instance but a different TS class identity. Cast
  // to `unknown` once at the boundary instead of importing two
  // overlapping definitions.
  const draw = new TerraDraw({
    adapter: new TerraDrawMapLibreGLAdapter({ map: m as unknown as never }),
    modes: [new TerraDrawPolygonMode()],
  });
  draw.start();
  draw.setMode("polygon");
  active = draw;

  onFinishOnce = (id) => {
    const feats = draw.getSnapshot() as DrawFeature[];
    const feature = feats.find((f) => f.id === id);
    if (!feature || feature.geometry.type !== "Polygon") {
      stopDrawing();
      useAppStore.getState().setDrawingMode(false);
      return;
    }
    const geom = feature.geometry;
    const stats = computeStatsForPolygon(m, geom);
    const bbox = turfBbox({
      type: "Feature",
      properties: {},
      geometry: geom,
    } as GeoJSON.Feature<GeoJSON.Polygon>);
    const bounds: [[number, number], [number, number]] = [
      [bbox[0]!, bbox[1]!],
      [bbox[2]!, bbox[3]!],
    ];
    const defaultName = `Area ${useAppStore.getState().userPolygons.length + 1}`;
    const name = window.prompt("Name this area:", defaultName) ?? defaultName;
    if (name.trim()) {
      useAppStore.getState().addUserPolygon({
        name: name.trim(),
        geometry: geom,
        bounds,
        stats,
      });
    }
    stopDrawing();
    useAppStore.getState().setDrawingMode(false);
  };

  // terra-draw fires `finish` when the polygon is closed.
  draw.on("finish", (id) => onFinishOnce?.(id));
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
  onFinishOnce = null;
}

export function isDrawing(): boolean {
  return active !== null;
}

/** Sample stats inside a polygon from the currently-rendered map state.
 *  Susceptibility cells come from queryRenderedFeatures (so the filter
 *  expression that hides below-threshold cells is respected), IFFI from
 *  the same path. */
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

  // Cells: use the centroid of the rendered geometry as the test point.
  // queryRenderedFeatures may emit a feature multiple times (one per
  // tile that clips it); de-dupe on cell_id when possible.
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
    // arithmetic mean of the outer ring is fine for our 200m cells.
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
