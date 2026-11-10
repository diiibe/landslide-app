import { LANDSLIDE_CLASSES, selectedClasses, type LandslideStyle } from "@/lib/landslideClasses";
import type { ExpressionSpecification, Map as MLMap } from "maplibre-gl";
import type { V2Layer } from "@/app/types";
import { RAMP_STOPS, rampColorAt } from "../style";

/**
 * Model v2 (HazardFVG) layers, built by `pipelines/model_v2.py`. Each of
 * the two layers (bodies, diffuse) is drawn from two archives that split
 * the zoom range at V2_VECTOR_MIN_ZOOM:
 *
 * - z6-9: one `v2_<layer>_raster_classN.pmtiles` per selected class, rendered from the
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
  return [...v2RasterLayerIds(which), V2_LAYER_ID[which]];
}

/** Colour of class `cls` out of `ncls`: evenly spread over the earthy
 *  warm-to-vivid-red ramp, so five classes land exactly on its five stops. Same visual
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

export type SusceptibilityStyle = LandslideStyle;
const defaultStyle: SusceptibilityStyle = { minClass: 4, classes: [4, 5], opacity: .45 };
export const v2RasterLayerIds = (which: V2Layer) => LANDSLIDE_CLASSES.map(c =>
  c === 1 ? V2_RASTER_LAYER_ID[which] : `${V2_RASTER_LAYER_ID[which]}-${c}`);

/** Single-class PNG masks keep arbitrary selections exact even below z10.
 * Sources are lazy and reused when a class is hidden and shown again. */
export function addModelV2Layer(m: MLMap, which: V2Layer, beforeId?: string,
  settings: SusceptibilityStyle = defaultStyle): void {
  const chosen = selectedClasses(settings);
  for (const c of chosen) {
    const rasterId = v2RasterLayerIds(which)[c - 1]!;
    const rasterSrc = c === 1 ? V2_RASTER_SOURCE_ID[which] : `${V2_RASTER_SOURCE_ID[which]}-${c}`;
    if (!m.getSource(rasterSrc)) m.addSource(rasterSrc, {
      type: "raster", tileSize: 256,
      url: `pmtiles://${import.meta.env.BASE_URL}tiles/v2_${which}_raster_class${c}.pmtiles?palette=red-v1`,
    });
    if (!m.getLayer(rasterId)) m.addLayer({ id: rasterId, type: "raster", source: rasterSrc,
      maxzoom: V2_VECTOR_MIN_ZOOM,
      paint: { "raster-opacity": settings.opacity, "raster-resampling": "nearest", "raster-fade-duration": 0 },
    }, beforeId);
  }
  const src = V2_SOURCE_ID[which], id = V2_LAYER_ID[which];
  if (!m.getSource(src)) m.addSource(src, { type: "vector", url: `pmtiles://${import.meta.env.BASE_URL}tiles/v2_${which}.pmtiles` });
  if (!m.getLayer(id)) m.addLayer({ id, type: "fill", source: src, "source-layer": "cells",
    minzoom: V2_VECTOR_MIN_ZOOM,
    paint: { "fill-color": CLASS_FILL, "fill-opacity": settings.opacity, "fill-outline-color": "rgba(0,0,0,0)" },
  }, beforeId);
}
export function setModelV2Visible(m: MLMap, which: V2Layer, visible: boolean,
  beforeId?: string, settings: SusceptibilityStyle = defaultStyle): void {
  const chosen = selectedClasses(settings);
  if (visible) {
    addModelV2Layer(m, which, beforeId, settings);
    m.setFilter(V2_LAYER_ID[which], ["in", ["get", "cls"], ["literal", chosen]]);
    m.setPaintProperty(V2_LAYER_ID[which], "fill-opacity", settings.opacity);
  }
  for (const [i, id] of v2RasterLayerIds(which).entries()) {
    if (!m.getLayer(id)) continue;
    m.setPaintProperty(id, "raster-opacity", settings.opacity);
    m.setLayoutProperty(id, "visibility", visible && chosen.includes(i + 1) ? "visible" : "none");
  }
  if (m.getLayer(V2_LAYER_ID[which])) m.setLayoutProperty(V2_LAYER_ID[which], "visibility", visible && chosen.length ? "visible" : "none");
}
