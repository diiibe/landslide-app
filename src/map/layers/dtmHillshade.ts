import type { Map as MLMap } from "maplibre-gl";

export const DEM_SOURCE = "dtm-dem";
export const DTM_LAYER = "dtm-hillshade";

/**
 * Adds a DTM hillshade overlay using Mapbox's terrain DEM raster source.
 * The whole FVG region is the J.2/J.3 study area, so painting elevation
 * across the basemap effectively colors the analysis extent. Hillshade
 * uses the sun-angle illumination MapLibre provides natively — no need
 * for a custom raster colorize step.
 *
 * Note: `mapbox.mapbox-terrain-dem-v1` is a Terrain-RGB style DEM in raster
 * format. MapLibre interprets it via `encoding: "mapbox"`.
 */
export function addDtmHillshade(m: MLMap, visible: boolean, dark: boolean): void {
  if (m.getLayer(DTM_LAYER)) m.removeLayer(DTM_LAYER);
  if (!m.getSource(DEM_SOURCE)) {
    m.addSource(DEM_SOURCE, {
      type: "raster-dem",
      url: "mapbox://mapbox.mapbox-terrain-dem-v1",
      tileSize: 512,
      encoding: "mapbox",
    });
  }
  m.addLayer({
    id: DTM_LAYER,
    type: "hillshade",
    source: DEM_SOURCE,
    paint: {
      "hillshade-exaggeration": 0.6,
      "hillshade-highlight-color": dark ? "#E2C996" : "#FFF6DD",
      "hillshade-shadow-color": dark ? "#0F0B05" : "#3F2914",
      "hillshade-accent-color": dark ? "#7A6342" : "#A28856",
      "hillshade-illumination-direction": 315,
    },
    layout: { visibility: visible ? "visible" : "none" },
  });
}

export function setDtmHillshadeVisible(m: MLMap, v: boolean): void {
  if (m.getLayer(DTM_LAYER)) {
    m.setLayoutProperty(DTM_LAYER, "visibility", v ? "visible" : "none");
  }
}
