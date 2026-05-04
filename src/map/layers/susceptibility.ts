import type { Map as MLMap } from "maplibre-gl";
import type { ModelId, Zone } from "@/app/types";
import { rampPaint } from "../style";

export const SUSCEPT_SOURCE = "cells";
export const SUSCEPT_LAYER = "susceptibility";

/**
 * Opacity model: only cells with `p >= threshold` are painted (0.85 alpha).
 * Cells below threshold are fully transparent — the basemap shows through
 * untouched. The complementary "Study area (DTM)" layer is what the user
 * toggles when they want to see the analysis extent regardless of p.
 */
function opacityForThreshold(threshold: number): unknown {
  return [
    "case",
    [">=", ["get", "p"], threshold], 0.85,
    0.0,
  ];
}

function zoneFilterFor(selectedZones: Zone[]): unknown {
  return selectedZones.length === 0
    ? ["all"]
    : ["in", ["get", "zone"], ["literal", selectedZones]];
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
      "fill-opacity": opacityForThreshold(threshold) as never,
      "fill-outline-color": "rgba(0,0,0,0)",
    },
    filter: zoneFilterFor(selectedZones) as never,
  });
}

export function updateSusceptibilityThreshold(m: MLMap, threshold: number): void {
  if (!m.getLayer(SUSCEPT_LAYER)) return;
  m.setPaintProperty(SUSCEPT_LAYER, "fill-opacity", opacityForThreshold(threshold) as never);
}

export function updateSusceptibilityZones(m: MLMap, selectedZones: Zone[]): void {
  if (!m.getLayer(SUSCEPT_LAYER)) return;
  m.setFilter(SUSCEPT_LAYER, zoneFilterFor(selectedZones) as never);
}

export function setSusceptibilityVisible(m: MLMap, v: boolean): void {
  if (m.getLayer(SUSCEPT_LAYER)) {
    m.setLayoutProperty(SUSCEPT_LAYER, "visibility", v ? "visible" : "none");
  }
}
