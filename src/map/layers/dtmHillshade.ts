import type { Map as MLMap } from "maplibre-gl";

export const DEM_SOURCE = "dtm-dem";
export const DTM_LAYER = "dtm-hillshade";

/**
 * Adds a DTM hillshade overlay backed by Mapbox's Terrain-RGB tileset.
 * The whole FVG region is the J.2/J.3 study area, so painting elevation
 * across the basemap effectively colors the analysis extent. Hillshade
 * uses the sun-angle illumination MapLibre provides natively — no need
 * for a custom raster colorize step. The same source feeds the 3D
 * terrain toggle in MapView, so a single tile pipeline drives both.
 *
 * Why `mapbox.terrain-rgb` and not `mapbox.mapbox-terrain-dem-v1`:
 * Mapbox restricts the newer `terrain-dem-v1` tileset to their own
 * SDKs (mapbox-gl-js, mapbox-maps-ios/android/flutter) — every request
 * from MapLibre returned 401 regardless of token scope. The older
 * Terrain-RGB v1 IS exposed via the public Raster Tiles API and works
 * with any standard Mapbox public token. Data is frozen as of
 * 2021-12-01 (no further elevation updates), which is fine here since
 * FVG ridgelines don't move on human timescales.
 *
 * `pngraw` format preserves the full 16-bit precision in the RGB
 * channels — MapLibre decodes via `encoding: "mapbox"` using the
 * standard Terrain-RGB formula
 *   elevation = -10000 + ((R*256*256 + G*256 + B) * 0.1).
 *
 * The source uses the `mapbox://` URL form so the map's central
 * `transformRequest` rewriter can append the access token at fetch
 * time. The `tiles: [...]` direct-URL form is avoided here because it
 * triggered a pending-forever `_tileJSONRequest` on maplibre 5.24 with
 * our raster-dem source.
 */
export function addDtmHillshade(m: MLMap, visible: boolean, dark: boolean): void {
  if (m.getLayer(DTM_LAYER)) m.removeLayer(DTM_LAYER);
  if (!m.getSource(DEM_SOURCE)) {
    m.addSource(DEM_SOURCE, {
      type: "raster-dem",
      url: "mapbox://mapbox.terrain-rgb",
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
