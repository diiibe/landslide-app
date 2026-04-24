import type { Map as MLMap } from "maplibre-gl";
import { SUSCEPT_SOURCE } from "./susceptibility";

export const ZONE_LINE = "zone-boundaries";

export function addZoneBoundaries(m: MLMap): void {
  if (m.getLayer(ZONE_LINE)) return;
  m.addLayer({
    id: ZONE_LINE,
    type: "line",
    source: SUSCEPT_SOURCE,
    "source-layer": "cells",
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
