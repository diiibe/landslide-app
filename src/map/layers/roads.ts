import type { Map as MLMap } from "maplibre-gl";

export const ROADS_SOURCE = "mapbox-streets";
export const ROADS_LAYER = "roads-overlay";

/**
 * Adds a road overlay drawn from the Mapbox Streets v8 vector tileset. The
 * `transformRequest` registered on the map already rewrites `mapbox://` URLs
 * to the public Mapbox API endpoint with the user's token, so this source
 * just works.
 *
 * We pick a single line layer that covers all motorable roads (the
 * `road` source-layer in streets-v8) and style it as a thin slate line so
 * it reads on top of any of our four basemaps without fighting them.
 */
export function addRoads(m: MLMap, visible: boolean, dark: boolean): void {
  if (m.getLayer(ROADS_LAYER)) m.removeLayer(ROADS_LAYER);
  if (!m.getSource(ROADS_SOURCE)) {
    m.addSource(ROADS_SOURCE, {
      type: "vector",
      url: "mapbox://mapbox.mapbox-streets-v8",
    });
  }
  const stroke = dark ? "#E2D2B6" : "#4A3C2A";
  const halo = dark ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.65)";

  m.addLayer({
    id: ROADS_LAYER,
    type: "line",
    source: ROADS_SOURCE,
    "source-layer": "road",
    // Filter to driveable classes — exclude paths/footways which would clutter.
    filter: [
      "match",
      ["get", "class"],
      ["motorway", "motorway_link", "trunk", "trunk_link", "primary", "primary_link",
       "secondary", "secondary_link", "tertiary", "tertiary_link", "street", "street_limited"],
      true,
      false,
    ],
    paint: {
      "line-color": stroke,
      "line-opacity": 0.85,
      "line-width": [
        "interpolate", ["exponential", 1.4], ["zoom"],
        7, 0.3,
        10, 0.8,
        13, 2.0,
        16, 4.0,
      ],
      "line-blur": 0.2,
    },
    layout: { visibility: visible ? "visible" : "none", "line-cap": "round", "line-join": "round" },
  });
  // Halo underneath for legibility on busy basemaps.
  if (m.getLayer(ROADS_LAYER + "-halo")) m.removeLayer(ROADS_LAYER + "-halo");
  m.addLayer(
    {
      id: ROADS_LAYER + "-halo",
      type: "line",
      source: ROADS_SOURCE,
      "source-layer": "road",
      filter: [
        "match",
        ["get", "class"],
        ["motorway", "motorway_link", "trunk", "trunk_link", "primary", "primary_link",
         "secondary", "secondary_link", "tertiary", "tertiary_link", "street", "street_limited"],
        true,
        false,
      ],
      paint: {
        "line-color": halo,
        "line-opacity": 0.7,
        "line-width": [
          "interpolate", ["exponential", 1.4], ["zoom"],
          7, 0.8,
          10, 1.6,
          13, 3.6,
          16, 6.5,
        ],
      },
      layout: { visibility: visible ? "visible" : "none", "line-cap": "round", "line-join": "round" },
    },
    ROADS_LAYER,
  );
}

export function setRoadsVisible(m: MLMap, v: boolean): void {
  for (const id of [ROADS_LAYER, ROADS_LAYER + "-halo"]) {
    if (m.getLayer(id)) m.setLayoutProperty(id, "visibility", v ? "visible" : "none");
  }
}
