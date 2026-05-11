import type { Map as MLMap } from "maplibre-gl";
import type { ModelId, Zone } from "@/app/types";
import { rampPaint } from "../style";

export const SUSCEPT_SOURCE = "cells";
export const SUSCEPT_LAYER = "susceptibility";

/**
 * Combined visibility + zone filter: only cells with `p >= threshold`
 * AND (no zone filter OR in the selected zones) are rendered. Using a
 * filter (rather than a 0-opacity case) means cells below threshold
 * are skipped by MapLibre's hit-testing too, so click handlers fire
 * only on the coloured at-risk cells the user can actually see.
 */
function susceptibilityFilter(
  threshold: number,
  selectedZones: Zone[],
): unknown {
  const thresholdClause = [">=", ["get", "p"], threshold];
  if (selectedZones.length === 0) return thresholdClause;
  return [
    "all",
    thresholdClause,
    ["in", ["get", "zone"], ["literal", selectedZones]],
  ];
}

export function addSusceptibility(
  m: MLMap,
  model: ModelId,
  threshold: number,
  selectedZones: Zone[],
): void {
  if (m.getLayer(SUSCEPT_LAYER)) m.removeLayer(SUSCEPT_LAYER);
  if (m.getSource(SUSCEPT_SOURCE)) m.removeSource(SUSCEPT_SOURCE);

  m.addSource(SUSCEPT_SOURCE, {
    type: "vector",
    url: `pmtiles://${import.meta.env.BASE_URL}tiles/${model}.pmtiles`,
  });

  m.addLayer({
    id: SUSCEPT_LAYER,
    type: "fill",
    source: SUSCEPT_SOURCE,
    "source-layer": "cells",
    paint: {
      "fill-color": rampPaint() as never,
      "fill-opacity": 0.85,
      "fill-outline-color": "rgba(0,0,0,0)",
    },
    filter: susceptibilityFilter(threshold, selectedZones) as never,
  });
}

export function updateSusceptibilityThreshold(
  m: MLMap,
  threshold: number,
  selectedZones: Zone[],
): void {
  if (!m.getLayer(SUSCEPT_LAYER)) return;
  m.setFilter(
    SUSCEPT_LAYER,
    susceptibilityFilter(threshold, selectedZones) as never,
  );
}

export function updateSusceptibilityZones(
  m: MLMap,
  threshold: number,
  selectedZones: Zone[],
): void {
  if (!m.getLayer(SUSCEPT_LAYER)) return;
  m.setFilter(
    SUSCEPT_LAYER,
    susceptibilityFilter(threshold, selectedZones) as never,
  );
}

export function setSusceptibilityVisible(m: MLMap, v: boolean): void {
  if (m.getLayer(SUSCEPT_LAYER)) {
    m.setLayoutProperty(SUSCEPT_LAYER, "visibility", v ? "visible" : "none");
  }
}
