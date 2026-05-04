import type { Map as MLMap } from "maplibre-gl";

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;

export const ROADS_SOURCE = "mapbox-streets";
export const ROADS_LAYER = "roads-overlay";
export const ROADS_HALO = "roads-overlay-halo";

/**
 * Roads overlay from Mapbox Streets v8. We register the source with explicit
 * https tile URLs so we don't depend on the `mapbox://` -> https rewrite
 * (which can mis-resolve under certain MapLibre code paths). Two stacked
 * line layers — wider halo underneath, thinner stroke on top — give
 * legibility on any basemap.
 */
export function addRoads(m: MLMap, visible: boolean, dark: boolean): void {
  if (m.getLayer(ROADS_LAYER)) m.removeLayer(ROADS_LAYER);
  if (m.getLayer(ROADS_HALO)) m.removeLayer(ROADS_HALO);
  if (m.getSource(ROADS_SOURCE)) m.removeSource(ROADS_SOURCE);

  if (!TOKEN) return;
  m.addSource(ROADS_SOURCE, {
    type: "vector",
    tiles: [
      `https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/{z}/{x}/{y}.vector.pbf?access_token=${TOKEN}`,
    ],
    minzoom: 0,
    maxzoom: 16,
  });

  const stroke = dark ? "#E2D2B6" : "#3A2F20";
  const halo = dark ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.7)";

  const filter = [
    "match",
    ["get", "class"],
    [
      "motorway", "motorway_link",
      "trunk", "trunk_link",
      "primary", "primary_link",
      "secondary", "secondary_link",
      "tertiary", "tertiary_link",
      "street", "street_limited",
    ],
    true,
    false,
  ];

  // Halo first (so it ends up below the stroke)
  m.addLayer({
    id: ROADS_HALO,
    type: "line",
    source: ROADS_SOURCE,
    "source-layer": "road",
    filter: filter as never,
    paint: {
      "line-color": halo,
      "line-opacity": 0.85,
      "line-width": [
        "interpolate", ["exponential", 1.4], ["zoom"],
        7, 1.0,
        10, 2.0,
        13, 4.0,
        16, 7.0,
      ],
    },
    layout: { visibility: visible ? "visible" : "none", "line-cap": "round", "line-join": "round" },
  });
  m.addLayer({
    id: ROADS_LAYER,
    type: "line",
    source: ROADS_SOURCE,
    "source-layer": "road",
    filter: filter as never,
    paint: {
      "line-color": stroke,
      "line-opacity": 0.95,
      "line-width": [
        "interpolate", ["exponential", 1.4], ["zoom"],
        7, 0.4,
        10, 1.0,
        13, 2.4,
        16, 4.5,
      ],
    },
    layout: { visibility: visible ? "visible" : "none", "line-cap": "round", "line-join": "round" },
  });
}

export function setRoadsVisible(m: MLMap, v: boolean): void {
  for (const id of [ROADS_HALO, ROADS_LAYER]) {
    if (m.getLayer(id)) m.setLayoutProperty(id, "visibility", v ? "visible" : "none");
  }
}
