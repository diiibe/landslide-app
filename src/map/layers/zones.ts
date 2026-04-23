import type { Map as MBMap } from "mapbox-gl";
import { SUSCEPT_SOURCE } from "./susceptibility";

export const ZONE_LINE = "zone-boundaries";

export function addZoneBoundaries(m: MBMap): void {
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

export function setZoneBoundariesVisible(m: MBMap, v: boolean): void {
  if (m.getLayer(ZONE_LINE)) {
    m.setLayoutProperty(ZONE_LINE, "visibility", v ? "visible" : "none");
  }
}
