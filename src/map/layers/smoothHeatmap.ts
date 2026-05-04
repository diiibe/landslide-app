import type { Map as MLMap } from "maplibre-gl";
import type { ModelId } from "@/app/types";

export const HEAT_SOURCE = "centroids";
export const HEAT_LAYER = "smooth-heatmap";

/** Weight ramp: cells below threshold contribute zero, cells above get a
 * weight that grows linearly from 0 at threshold to 1 at p=1. Re-applied
 * via `updateSmoothHeatmapThreshold` whenever the user moves the slider. */
function weightFor(threshold: number): unknown {
  return [
    "interpolate", ["linear"], ["get", "p"],
    Math.max(0, threshold - 0.001), 0,
    1, 1,
  ];
}

/**
 * KDE-style heatmap driven by per-cell centroids. Three things make it
 * read as a smooth surface rather than a fragmented spotty cloud:
 *
 *   - Big kernel radius (30 px at z6, 60 px at z14) so adjacent cells
 *     blend together into a continuous field.
 *   - Threshold-aware weight: only cells with p ≥ threshold contribute,
 *     so the heatmap shifts as the slider moves.
 *   - Strong intensity at low zoom so the regional pattern is visible
 *     immediately, fading at high zoom where the discrete cells take over.
 */
export function addSmoothHeatmap(
  m: MLMap,
  model: ModelId,
  threshold: number,
  visible: boolean,
): void {
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
      "heatmap-weight": weightFor(threshold) as never,
      "heatmap-intensity": [
        "interpolate", ["linear"], ["zoom"],
        6, 1.8,
        9, 2.4,
        12, 2.8,
        14, 2.0,
      ],
      "heatmap-color": [
        "interpolate", ["linear"], ["heatmap-density"],
        0,    "rgba(232,240,216,0)",
        0.10, "rgba(139,178,107,0.35)",
        0.30, "rgba(217,164,65,0.60)",
        0.55, "rgba(210,85,36,0.78)",
        0.85, "rgba(122,31,16,0.92)",
        1,    "rgba(70,15,8,0.98)",
      ],
      "heatmap-radius": [
        "interpolate", ["linear"], ["zoom"],
        6, 30,
        9, 40,
        12, 50,
        14, 60,
      ],
      "heatmap-opacity": [
        "interpolate", ["linear"], ["zoom"],
        6, 0.95,
        11, 0.85,
        14, 0.55,
      ],
    },
    layout: { visibility: visible ? "visible" : "none" },
  });
}

export function updateSmoothHeatmapThreshold(m: MLMap, threshold: number): void {
  if (!m.getLayer(HEAT_LAYER)) return;
  m.setPaintProperty(HEAT_LAYER, "heatmap-weight", weightFor(threshold) as never);
}

export function setSmoothHeatmapVisible(m: MLMap, v: boolean): void {
  if (m.getLayer(HEAT_LAYER)) {
    m.setLayoutProperty(HEAT_LAYER, "visibility", v ? "visible" : "none");
  }
}
