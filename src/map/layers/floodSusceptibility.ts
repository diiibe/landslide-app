import type { Map as MLMap } from "maplibre-gl";

/**
 * Flood susceptibility overlay — XYZ raster tile pyramid produced by
 * `cloud/build_overlay_rasters.py` + `gdal2tiles.py` (zoom 8-13,
 * EPSG:4326, native 10 m grid).
 *
 * Four mutually-exclusive views, all clipped to p>=0.5 (pixels below
 * threshold are fully transparent, so the overlay only paints the at-
 * risk areas):
 *
 *   - "combined" : 3-class PAI-style map (red P3, orange P2-only, yellow P1-only).
 *   - "P3"       : red ramp on pixels classified severe (P3 >= 0.5).
 *   - "P2plus"   : orange ramp on pixels classified medium (P2plus >= 0.5 & not P3).
 *   - "P1plus"   : yellow ramp on pixels classified low (P1plus >= 0.5 & not P2/P3).
 *
 * Models trained on 2026-05-15 (RTX 4090 vast.ai); OOF AUC
 * P3 = 0.78, P2plus = 0.80, P1plus = 0.86.
 */
export type FloodView = "combined" | "P3" | "P2plus" | "P1plus";

const SOURCE_ID = "flood-overlay";
const LAYER_ID = "flood-overlay";

function tilesUrl(view: FloodView): string {
  const path = view === "combined" ? "combined" : `${view}_only`;
  return `${import.meta.env.BASE_URL}flood/tiles/${path}/{z}/{x}/{y}.png`;
}

export function addFloodOverlay(
  m: MLMap,
  view: FloodView = "combined",
  opacity = 0.85,
): void {
  if (m.getLayer(LAYER_ID)) m.removeLayer(LAYER_ID);
  if (m.getSource(SOURCE_ID)) m.removeSource(SOURCE_ID);

  m.addSource(SOURCE_ID, {
    type: "raster",
    tiles: [tilesUrl(view)],
    tileSize: 256,
    minzoom: 8,
    maxzoom: 13,
    attribution:
      "Flood susceptibility · ml-flood-mapping (XGBoost on PAI 2024, spatial CV, 2026-05-15)",
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

export function setFloodView(m: MLMap, view: FloodView): void {
  // Tile URL is fixed at source-add time, so swapping views means
  // re-adding source+layer. Preserve current opacity + visibility.
  const layer = m.getLayer(LAYER_ID);
  const opacity = layer
    ? (m.getPaintProperty(LAYER_ID, "raster-opacity") as number | undefined) ?? 0.85
    : 0.85;
  const visible = layer
    ? (m.getLayoutProperty(LAYER_ID, "visibility") as string | undefined) !== "none"
    : true;
  addFloodOverlay(m, view, opacity);
  if (!visible) setFloodVisible(m, false);
}

export function setFloodVisible(m: MLMap, visible: boolean): void {
  if (m.getLayer(LAYER_ID)) {
    m.setLayoutProperty(LAYER_ID, "visibility", visible ? "visible" : "none");
  }
}

export function setFloodOpacity(m: MLMap, opacity: number): void {
  if (m.getLayer(LAYER_ID)) {
    m.setPaintProperty(LAYER_ID, "raster-opacity", opacity);
  }
}

export function removeFloodOverlay(m: MLMap): void {
  if (m.getLayer(LAYER_ID)) m.removeLayer(LAYER_ID);
  if (m.getSource(SOURCE_ID)) m.removeSource(SOURCE_ID);
}

export const FLOOD_LAYER_ID = LAYER_ID;
export const FLOOD_SOURCE_ID = SOURCE_ID;
