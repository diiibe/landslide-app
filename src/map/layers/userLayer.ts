/**
 * Render user-uploaded layers (GPX tracks, GeoJSON overlays) on top of
 * every other map data. Each layer becomes one GeoJSON source plus a
 * stacked trio of MapLibre layers — *glow* + *halo* + *stroke* for
 * lines, plus a *waypoint* circle layer for points — which together
 * read as a fluorescent, easy-to-see track over any basemap (light,
 * dark, or satellite).
 */

import type {
  Map as MLMap,
  ExpressionSpecification,
  GeoJSONSource,
} from "maplibre-gl";
import type { UserLayer } from "@/app/types";
import { useAppStore } from "@/app/store";
import { trailColor, trailGlow } from "./trails";

/** Per-feature paint helpers. When the layer is in `riskHeatmap` mode
 *  the line stack borrows the trails ramp (tinted by per-segment baked
 *  risk); otherwise the user-picked solid colour wins. */
function lineColorFor(layer: UserLayer): string | ExpressionSpecification {
  if (layer.colorMode === "riskHeatmap") {
    const s = useAppStore.getState();
    return trailColor(s.riskParams.trails[s.model].sensitivity);
  }
  return layer.color;
}
function glowColorFor(layer: UserLayer): string | ExpressionSpecification {
  if (layer.colorMode === "riskHeatmap") {
    const s = useAppStore.getState();
    return trailGlow(s.riskParams.trails[s.model].sensitivity);
  }
  return layer.color;
}

/** Source / layer id derivation. Stable across re-renders for a given
 *  user-layer id so React's reactivity can use `setData` instead of
 *  remove+add for opacity/colour tweaks. */
function ids(layer: UserLayer) {
  const sid = `user-src-${layer.id}`;
  return {
    src: sid,
    glow: `${sid}-glow`,
    halo: `${sid}-halo`,
    stroke: `${sid}-stroke`,
    point: `${sid}-point`,
    pointLabel: `${sid}-point-label`,
  };
}

/** Add a user layer to the map. Idempotent: if a layer with the same id
 *  already exists the function tears it down first. */
export function addUserLayer(m: MLMap, layer: UserLayer): void {
  removeUserLayer(m, layer.id);

  const id = ids(layer);
  m.addSource(id.src, { type: "geojson", data: layer.data });

  const isLine: ExpressionSpecification = [
    "any",
    ["==", ["geometry-type"], "LineString"],
    ["==", ["geometry-type"], "MultiLineString"],
  ];
  const isPoint: ExpressionSpecification = [
    "any",
    ["==", ["geometry-type"], "Point"],
    ["==", ["geometry-type"], "MultiPoint"],
  ];

  // GLOW — wide soft halo via line-blur; gives the "luminous" feel.
  m.addLayer({
    id: id.glow,
    type: "line",
    source: id.src,
    filter: isLine,
    layout: {
      visibility: layer.visible ? "visible" : "none",
      "line-cap": "round",
      "line-join": "round",
    },
    paint: {
      "line-color": glowColorFor(layer),
      "line-opacity": 0.35 * layer.opacity,
      "line-blur": 6,
      "line-width": [
        "interpolate", ["exponential", 1.4], ["zoom"],
        6, 4,
        10, 8,
        14, 14,
        16, 20,
      ],
    },
  });

  // HALO — solid mid-width band underneath the stroke.
  m.addLayer({
    id: id.halo,
    type: "line",
    source: id.src,
    filter: isLine,
    layout: {
      visibility: layer.visible ? "visible" : "none",
      "line-cap": "round",
      "line-join": "round",
    },
    paint: {
      "line-color": lineColorFor(layer),
      "line-opacity": 0.65 * layer.opacity,
      "line-width": [
        "interpolate", ["exponential", 1.4], ["zoom"],
        6, 2.2,
        10, 4,
        14, 6.5,
        16, 9,
      ],
    },
  });

  // STROKE — bright inner line at full opacity.
  m.addLayer({
    id: id.stroke,
    type: "line",
    source: id.src,
    filter: isLine,
    layout: {
      visibility: layer.visible ? "visible" : "none",
      "line-cap": "round",
      "line-join": "round",
    },
    paint: {
      "line-color": "#FFFFFF",
      "line-opacity": 0.95 * layer.opacity,
      "line-width": [
        "interpolate", ["exponential", 1.4], ["zoom"],
        6, 0.6,
        10, 1.2,
        14, 2,
        16, 3,
      ],
    },
  });

  // POINTS — waypoints / placemarks with a coloured fill and white halo.
  m.addLayer({
    id: id.point,
    type: "circle",
    source: id.src,
    filter: isPoint,
    layout: { visibility: layer.visible ? "visible" : "none" },
    paint: {
      "circle-radius": [
        "interpolate", ["linear"], ["zoom"],
        8, 3,
        12, 5,
        16, 7,
      ],
      "circle-color": layer.color,
      "circle-opacity": 0.9 * layer.opacity,
      "circle-stroke-color": "#FFFFFF",
      "circle-stroke-width": 1.5,
      "circle-stroke-opacity": 0.9 * layer.opacity,
    },
  });
}

export function removeUserLayer(m: MLMap, layerId: string): void {
  const id = ids({ id: layerId } as UserLayer);
  for (const lid of [id.glow, id.halo, id.stroke, id.point, id.pointLabel]) {
    if (m.getLayer(lid)) m.removeLayer(lid);
  }
  if (m.getSource(id.src)) m.removeSource(id.src);
}

/** Push a fresh FeatureCollection into the existing source — no
 *  remove+add churn. Used when the source data itself changes (rare). */
export function updateUserLayerData(m: MLMap, layer: UserLayer): void {
  const id = ids(layer);
  const src = m.getSource(id.src) as GeoJSONSource | undefined;
  if (src) src.setData(layer.data);
}

/** Recompute paint properties when the user retints / re-opacifies /
 *  toggles a layer. Cheap: just setPaintProperty + setLayoutProperty. */
export function applyUserLayer(m: MLMap, layer: UserLayer): void {
  const id = ids(layer);
  const vis = layer.visible ? "visible" : "none";
  for (const lid of [id.glow, id.halo, id.stroke, id.point]) {
    if (!m.getLayer(lid)) continue;
    m.setLayoutProperty(lid, "visibility", vis);
  }
  if (m.getLayer(id.glow)) {
    m.setPaintProperty(id.glow, "line-color", glowColorFor(layer));
    m.setPaintProperty(id.glow, "line-opacity", 0.35 * layer.opacity);
  }
  if (m.getLayer(id.halo)) {
    m.setPaintProperty(id.halo, "line-color", lineColorFor(layer));
    m.setPaintProperty(id.halo, "line-opacity", 0.65 * layer.opacity);
  }
  if (m.getLayer(id.stroke)) {
    m.setPaintProperty(id.stroke, "line-opacity", 0.95 * layer.opacity);
  }
  if (m.getLayer(id.point)) {
    m.setPaintProperty(id.point, "circle-color", layer.color);
    m.setPaintProperty(id.point, "circle-opacity", 0.9 * layer.opacity);
    m.setPaintProperty(id.point, "circle-stroke-opacity", 0.9 * layer.opacity);
  }
}

/** Move every layer that backs `layer` to the very top of the style.
 *  Called after model layers re-render so user uploads always stay
 *  above. */
export function bringUserLayerToFront(m: MLMap, layerId: string): void {
  const id = ids({ id: layerId } as UserLayer);
  for (const lid of [id.glow, id.halo, id.stroke, id.point]) {
    if (m.getLayer(lid)) m.moveLayer(lid);
  }
}
