import type { Map as MLMap } from "maplibre-gl";

/**
 * Model-vs-PAI comparison overlay. Each pixel classified into one of:
 *
 *   - 🟢 green  AGREEMENT — both model (P1plus >= 0.5) and PAI say risk
 *               (the model confirms the official mapping).
 *   - 🔵 cyan   EXTENSION — model says risk where PAI does not
 *               (where the model "generalizes" beyond PAI — could be a
 *               real risk PAI missed OR a false positive).
 *   - 🟣 magenta MISS    — PAI says risk but the model fails
 *               (model under-prediction; areas where physics alone is
 *               not enough and human-mapped knowledge wins).
 *   - transparent: both agree no risk.
 *
 * The interesting layers for understanding model behaviour are the
 * CYAN (where do we add information?) and MAGENTA (where are we
 * blind?).
 *
 * Tiles built by `cloud/build_pai_and_diff.py` + `gdal2tiles.py`.
 */

const SOURCE_ID = "diff-overlay";
const LAYER_ID = "diff-overlay";

function tilesUrl(): string {
  return `${import.meta.env.BASE_URL}flood/tiles/diff/{z}/{x}/{y}.png`;
}

export function addDiffOverlay(m: MLMap, opacity = 0.9): void {
  if (m.getLayer(LAYER_ID)) m.removeLayer(LAYER_ID);
  if (m.getSource(SOURCE_ID)) m.removeSource(SOURCE_ID);
  m.addSource(SOURCE_ID, {
    type: "raster",
    tiles: [tilesUrl()],
    tileSize: 256,
    minzoom: 8,
    maxzoom: 13,
    attribution: "Model vs PAI comparison · ml-flood-mapping 2026-05-15",
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

export function setDiffVisible(m: MLMap, v: boolean): void {
  if (m.getLayer(LAYER_ID)) m.setLayoutProperty(LAYER_ID, "visibility", v ? "visible" : "none");
}

export function setDiffOpacity(m: MLMap, o: number): void {
  if (m.getLayer(LAYER_ID)) m.setPaintProperty(LAYER_ID, "raster-opacity", o);
}

export function removeDiffOverlay(m: MLMap): void {
  if (m.getLayer(LAYER_ID)) m.removeLayer(LAYER_ID);
  if (m.getSource(SOURCE_ID)) m.removeSource(SOURCE_ID);
}

export const DIFF_LAYER_ID = LAYER_ID;
export const DIFF_SOURCE_ID = SOURCE_ID;
