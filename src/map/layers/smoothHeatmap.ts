import type { Map as MLMap } from "maplibre-gl";
import type { ModelId } from "@/app/types";

export const HEAT_SOURCE = "centroids";
export const HEAT_LAYER = "smooth-heatmap";

/**
 * Adds the kernel-density heatmap layer driven by per-cell centroids. Each
 * point is weighted by `p` so high-susceptibility clusters glow more strongly
 * than scattered low-p cells. Blur radius scales with zoom: tight at high
 * zoom (1 cell ≈ 1 pixel kernel), wide at low zoom (region-level glow).
 */
export function addSmoothHeatmap(m: MLMap, model: ModelId, visible: boolean): void {
  if (m.getLayer(HEAT_LAYER)) m.removeLayer(HEAT_LAYER);
  if (m.getSource(HEAT_SOURCE)) m.removeSource(HEAT_SOURCE);

  m.addSource(HEAT_SOURCE, {
    type: "vector",
    url: `pmtiles://${import.meta.env.BASE_URL}tiles/centroids_${model}.pmtiles`,
  });

  m.addLayer({
    id: HEAT_LAYER,
    type: "heatmap",
    source: HEAT_SOURCE,
    "source-layer": "centroids",
    paint: {
      // Per-point weight scales with p (0..1).
      "heatmap-weight": ["interpolate", ["linear"], ["get", "p"], 0, 0, 1, 1],
      // Total intensity rises with zoom (more points contribute per pixel).
      "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 6, 0.6, 14, 2.5],
      // Same naturalistic ramp as the discrete cells, blended for KDE.
      "heatmap-color": [
        "interpolate", ["linear"], ["heatmap-density"],
        0,    "rgba(232,240,216,0)",
        0.15, "rgba(139,178,107,0.45)",
        0.40, "rgba(217,164,65,0.65)",
        0.70, "rgba(210,85,36,0.80)",
        1,    "rgba(122,31,16,0.95)",
      ],
      // Kernel radius: smaller at low zoom (don't over-blur), grows with zoom.
      "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 6, 8, 11, 18, 14, 32],
      // Fade out as user gets close — at z>=13 the discrete cells are clearer.
      "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 11, 0.9, 14, 0.55],
    },
    layout: { visibility: visible ? "visible" : "none" },
  });
}

export function setSmoothHeatmapVisible(m: MLMap, v: boolean): void {
  if (m.getLayer(HEAT_LAYER)) {
    m.setLayoutProperty(HEAT_LAYER, "visibility", v ? "visible" : "none");
  }
}
