import type { ExpressionSpecification, Map as MLMap } from "maplibre-gl";
import type { V2Layer } from "@/app/types";
import { RAMP_STOPS, rampColorAt } from "../style";

/**
 * Model v2 (HazardFVG) cell layers: `v2_bodies.pmtiles` and
 * `v2_diffuse.pmtiles`, built by `pipelines/model_v2.py`. Each tile
 * feature is one 120 m cell (or, at low zoom, coalesced cells of one
 * class and source) with `score`, `source`, `cls` (quantile class
 * 1..ncls) and `ncls` (the layer's class count: 5 unless tied quantiles
 * collapsed, never fewer than 3).
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
