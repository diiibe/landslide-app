import type { ExpressionSpecification, Map as MLMap } from "maplibre-gl";
import type { V2Layer } from "@/app/types";
import { RAMP_STOPS, rampColorAt } from "../style";

/**
 * Model v2 (HazardFVG) layers, built by `pipelines/model_v2.py`. Each of
 * the two layers (bodies, diffuse) is drawn from two archives that split
 * the zoom range at V2_VECTOR_MIN_ZOOM:
 *
 * - z6-9: `v2_<layer>_raster.pmtiles`, palette PNGs rendered from the
 *   120 m class grid (nearest cell per pixel, same colours), because the
 *   cell polygons made vector tiles of 0.6-0.9 MB at those zooms;
 * - z10+: `v2_<layer>.pmtiles`, one feature per 120 m cell (coalesced
 *   only with cells of the same class and source) with `score`, `source`,
 *   `cls` (quantile class 1..ncls) and `ncls` (the layer's class count: 5
 *   unless tied quantiles collapsed, never fewer than 3). The popup reads
 *   these, so it only answers from z10.
 *
 * The two halves are added, ordered and switched together.
 *
 * The two layers are separate sources and separate layers: they are
 * never merged, and the store keeps at most one of them visible. They
 * are added lazily on first enable, because the tiles may not exist
 * yet (the toggles stay disabled until model_v2.json loads).
 */

/** First zoom drawn from vector cells; mirrors VECTOR_ZOOMS in the pipeline. */
export const V2_VECTOR_MIN_ZOOM = 10;

/** Vector (z10+) layer ids — the ones the popup queries. */
export const V2_LAYER_ID: Record<V2Layer, string> = {
  bodies: "v2-bodies",
  diffuse: "v2-diffuse",
};
/** Raster (z6-9) layer ids. */
export const V2_RASTER_LAYER_ID: Record<V2Layer, string> = {
  bodies: "v2-bodies-raster",
  diffuse: "v2-diffuse-raster",
};
const V2_SOURCE_ID: Record<V2Layer, string> = {
  bodies: "v2-bodies-src",
  diffuse: "v2-diffuse-src",
};
const V2_RASTER_SOURCE_ID: Record<V2Layer, string> = {
  bodies: "v2-bodies-raster-src",
  diffuse: "v2-diffuse-raster-src",
};

/** Every map layer id of one v2 layer, bottom to top. */
export function v2LayerIds(which: V2Layer): string[] {
  return [V2_RASTER_LAYER_ID[which], V2_LAYER_ID[which]];
}

/** Colour of class `cls` out of `ncls`: evenly spread over the earthy
 *  ramp, so five classes land exactly on its five stops. Same visual
 *  language as J.x without sharing its probability scale. */
export function v2ClassColor(cls: number, ncls: number): string {
  return rampColorAt(ncls > 1 ? (cls - 1) / (ncls - 1) : 1);
}

/** GPU-side twin of `v2ClassColor`, reading `cls` / `ncls` per feature. */
const CLASS_FILL = [
  "interpolate",
  ["linear"],
  ["/", ["-", ["get", "cls"], 1], ["max", ["-", ["get", "ncls"], 1], 1]],
  ...RAMP_STOPS.flat(),
] as unknown as ExpressionSpecification;

export function addModelV2Layer(m: MLMap, which: V2Layer, beforeId?: string): void {
  const rasterSrc = V2_RASTER_SOURCE_ID[which];
  const rasterId = V2_RASTER_LAYER_ID[which];
  if (!m.getSource(rasterSrc)) {
    m.addSource(rasterSrc, {
      type: "raster",
      url: `pmtiles://${import.meta.env.BASE_URL}tiles/v2_${which}_raster.pmtiles`,
      tileSize: 256,
    });
  }
  if (!m.getLayer(rasterId)) {
    m.addLayer({
      id: rasterId,
      type: "raster",
      source: rasterSrc,
      maxzoom: V2_VECTOR_MIN_ZOOM,
      paint: {
        "raster-opacity": 0.85,
        // Stretching a z9 tile must not blend neighbouring classes.
        "raster-resampling": "nearest",
        "raster-fade-duration": 0,
      },
    }, beforeId);
  }

  const src = V2_SOURCE_ID[which];
  const id = V2_LAYER_ID[which];
  if (!m.getSource(src)) {
    m.addSource(src, {
      type: "vector",
      url: `pmtiles://${import.meta.env.BASE_URL}tiles/v2_${which}.pmtiles`,
    });
  }
  if (!m.getLayer(id)) {
    m.addLayer({
      id,
      type: "fill",
      source: src,
      "source-layer": "cells",
      minzoom: V2_VECTOR_MIN_ZOOM,
      paint: {
        "fill-color": CLASS_FILL,
        "fill-opacity": 0.85,
        "fill-outline-color": "rgba(0,0,0,0)",
      },
    }, beforeId);
  }
}

/** Show/hide one v2 layer (both halves), adding it below `beforeId` on
 *  first show. Hiding never adds, so missing tiles are never requested
 *  while off. */
export function setModelV2Visible(
  m: MLMap,
  which: V2Layer,
  visible: boolean,
  beforeId?: string,
): void {
  if (visible && !m.getLayer(V2_LAYER_ID[which])) addModelV2Layer(m, which, beforeId);
  for (const id of v2LayerIds(which)) {
    if (m.getLayer(id)) m.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
  }
}
