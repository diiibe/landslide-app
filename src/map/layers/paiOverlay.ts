import type { Map as MLMap } from "maplibre-gl";

/**
 * PAI ground-truth overlay — flood hazard mapping published by the
 * Autorità di Bacino delle Alpi Orientali (the official "fasce di
 * pericolosità" used as training labels for our model).
 *
 * Same 3-class color scheme as the model's "combined" view, so the two
 * maps are directly comparable at a glance:
 *   - red    = PAI P3 (severe, TR ~30 yr)
 *   - orange = PAI P2 only (medium, TR ~100-200 yr; not P3)
 *   - yellow = PAI P1 only (low, TR ~300-500 yr; not P2/P3)
 *   - transparent everywhere PAI doesn't map a class
 *
 * Tiles: pyramid built by `cloud/build_pai_and_diff.py` + `gdal2tiles.py`
 * (zoom 8-13, EPSG:4326, FVG outline clipped).
 */

const SOURCE_ID = "pai-overlay";
const LAYER_ID = "pai-overlay";

function tilesUrl(): string {
  return `${import.meta.env.BASE_URL}flood/tiles/pai/{z}/{x}/{y}.png`;
}

export function addPaiOverlay(m: MLMap, opacity = 0.85): void {
  if (m.getLayer(LAYER_ID)) m.removeLayer(LAYER_ID);
  if (m.getSource(SOURCE_ID)) m.removeSource(SOURCE_ID);
  m.addSource(SOURCE_ID, {
    type: "raster",
    tiles: [tilesUrl()],
    tileSize: 256,
    minzoom: 8,
    maxzoom: 13,
    attribution: "PAI fasce · Autorità di Bacino Alpi Orientali (training labels)",
  });
  m.addLayer({
    id: LAYER_ID,
    type: "raster",
    source: SOURCE_ID,
    paint: {
      "raster-opacity": opacity,
      "raster-fade-duration": 100,
      "raster-resampling": "nearest",
    },
  });
}

export function setPaiVisible(m: MLMap, v: boolean): void {
  if (m.getLayer(LAYER_ID)) m.setLayoutProperty(LAYER_ID, "visibility", v ? "visible" : "none");
}

export function setPaiOpacity(m: MLMap, o: number): void {
  if (m.getLayer(LAYER_ID)) m.setPaintProperty(LAYER_ID, "raster-opacity", o);
}

export function removePaiOverlay(m: MLMap): void {
  if (m.getLayer(LAYER_ID)) m.removeLayer(LAYER_ID);
  if (m.getSource(SOURCE_ID)) m.removeSource(SOURCE_ID);
}

export const PAI_LAYER_ID = LAYER_ID;
export const PAI_SOURCE_ID = SOURCE_ID;
