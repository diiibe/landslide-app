import type { Map as MBMap } from "mapbox-gl";
import type { ModelId, Zone } from "@/app/types";
import { rampPaint } from "../style";

export const SUSCEPT_SOURCE = "cells";
export const SUSCEPT_LAYER = "susceptibility";

export function addSusceptibility(
  m: MBMap,
  model: ModelId,
  threshold: number,
  selectedZones: Zone[],
): void {
  if (m.getLayer(SUSCEPT_LAYER)) m.removeLayer(SUSCEPT_LAYER);
  if (m.getSource(SUSCEPT_SOURCE)) m.removeSource(SUSCEPT_SOURCE);

  m.addSource(SUSCEPT_SOURCE, {
    type: "vector",
    url: `pmtiles:///tiles/${model}.pmtiles`,
  });

  const zoneFilter: unknown =
    selectedZones.length === 0
      ? ["all"]
      : ["in", ["get", "zone"], ["literal", selectedZones]];

  m.addLayer({
    id: SUSCEPT_LAYER,
    type: "fill",
    source: SUSCEPT_SOURCE,
    "source-layer": "cells",
    paint: {
      "fill-color": rampPaint() as never,
      "fill-opacity": [
        "case",
        [">=", ["get", "p"], threshold], 0.85,
        0.0,
      ],
      "fill-outline-color": "rgba(0,0,0,0)",
    },
    filter: zoneFilter as never,
  });
}

export function updateSusceptibilityThreshold(m: MBMap, threshold: number): void {
  if (!m.getLayer(SUSCEPT_LAYER)) return;
  m.setPaintProperty(SUSCEPT_LAYER, "fill-opacity", [
    "case",
    [">=", ["get", "p"], threshold], 0.85,
    0.0,
  ]);
}

export function updateSusceptibilityZones(m: MBMap, selectedZones: Zone[]): void {
  if (!m.getLayer(SUSCEPT_LAYER)) return;
  const filter =
    selectedZones.length === 0
      ? ["all"]
      : ["in", ["get", "zone"], ["literal", selectedZones]];
  m.setFilter(SUSCEPT_LAYER, filter as never);
}

export function setSusceptibilityVisible(m: MBMap, v: boolean): void {
  if (m.getLayer(SUSCEPT_LAYER)) {
    m.setLayoutProperty(SUSCEPT_LAYER, "visibility", v ? "visible" : "none");
  }
}
