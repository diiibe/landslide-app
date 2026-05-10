import type { Map as MLMap } from "maplibre-gl";
import { SUSCEPT_SOURCE } from "./susceptibility";

export const ZONE_LINE = "zone-boundaries";

/**
 * Adds the zone-boundaries layer. Pass `visible` so the layer enters the
 * style with the correct visibility on the same frame instead of
 * appearing once and then collapsing when `setZoneBoundariesVisible` runs
 * a tick later (P3 nit — visible flash on style swap).
 */
export function addZoneBoundaries(m: MLMap, visible: boolean): void {
  if (m.getLayer(ZONE_LINE)) return;
  m.addLayer({
    id: ZONE_LINE,
    type: "line",
    source: SUSCEPT_SOURCE,
    "source-layer": "cells",
    layout: { visibility: visible ? "visible" : "none" },
    paint: {
      "line-color": "rgba(47,93,58,.35)",
      "line-width": 0.4,
    },
  });
}

export function setZoneBoundariesVisible(m: MLMap, v: boolean): void {
  if (m.getLayer(ZONE_LINE)) {
    m.setLayoutProperty(ZONE_LINE, "visibility", v ? "visible" : "none");
  }
}
