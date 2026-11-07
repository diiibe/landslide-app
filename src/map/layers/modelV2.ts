import type { ExpressionSpecification, Map as MLMap } from "maplibre-gl";
import type { V2Layer } from "@/app/types";
import { RAMP_STOPS } from "../style";

/**
 * Model v2 (HazardFVG) cell layers: `v2_bodies.pmtiles` and
 * `v2_diffuse.pmtiles`, built by `pipelines/model_v2.py`. Each tile
 * feature is one 120 m cell with `score`, `source` and `cls` (quantile
 * class 1..5, computed per layer by the pipeline).
 *
 * The two layers are separate sources and separate layers: they are
 * never merged, and the store keeps at most one of them visible. They
 * are added lazily on first enable, because the tiles may not exist
 * yet (the toggles stay disabled until model_v2.json loads).
 */

export const V2_LAYER_ID: Record<V2Layer, string> = {
  bodies: "v2-bodies",
  diffuse: "v2-diffuse",
};
const V2_SOURCE_ID: Record<V2Layer, string> = {
  bodies: "v2-bodies-src",
  diffuse: "v2-diffuse-src",
};

/** One colour per class, taken from the five stops of the earthy ramp so
 *  v2 reads in the same visual language as J.x without sharing its scale. */
export const V2_CLASS_COLORS: readonly string[] = RAMP_STOPS.map(([, c]) => c);

const CLASS_FILL: ExpressionSpecification = [
  "match",
  ["get", "cls"],
  ...V2_CLASS_COLORS.flatMap((c, i) => [i + 1, c]),
  "rgba(0,0,0,0)",
] as unknown as ExpressionSpecification;

export function addModelV2Layer(m: MLMap, which: V2Layer, beforeId?: string): void {
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
      paint: {
        "fill-color": CLASS_FILL,
        "fill-opacity": 0.85,
        "fill-outline-color": "rgba(0,0,0,0)",
      },
    }, beforeId);
  }
}

/** Show/hide one v2 layer, adding it (below `beforeId`) on first show.
 *  Hiding never adds, so missing tiles are never requested while off. */
export function setModelV2Visible(
  m: MLMap,
  which: V2Layer,
  visible: boolean,
  beforeId?: string,
): void {
  const id = V2_LAYER_ID[which];
  if (visible && !m.getLayer(id)) addModelV2Layer(m, which, beforeId);
  if (m.getLayer(id)) m.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
}
