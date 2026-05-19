import type { Map as MLMap, ExpressionSpecification } from "maplibre-gl";

/**
 * Historical flood observations from the Copernicus Emergency Management
 * Service (EMS) Rapid Mapping archive. Counterpart of the IFFI layer for
 * landslides — overlays satellite-mapped flood / hydrological-damage
 * polygons from past activations in Friuli Venezia Giulia.
 *
 * Source GeoJSON shipped at `public/flood/historical_floods.geojson`,
 * built by `ml-flood-mapping/pipelines/17_export_historical_floods_geojson.py`.
 *
 * Features (310 polygons, ~319 KB):
 *   EMSR225 Storm in Friuli, Aug 2017 — 4 AOI, GRADING products (hydro_damage)
 *   EMSR332 Vaia / NE Italy, Oct 2018, Pordenone AOI — DELINEATION (flood)
 *
 * Two distinct shades so the user can tell observed flood extents
 * (red-orange) apart from broader hydro-damage assessments (orange).
 * The styling is intentionally close to the IFFI palette so the two
 * "historical evidence" layers read as a family on the map.
 */

export const HFLOOD_SOURCE = "historical-floods";
export const HFLOOD_FILL = "historical-floods-fill";
export const HFLOOD_LINE = "historical-floods-line";

const COLOR_BY_KIND: ExpressionSpecification = [
  "match",
  ["get", "product_kind"],
  "flood",
  "#A51A2C",        // observed flooded area (deep red)
  "hydro_damage",
  "#D9521E",        // damage from a hydrological event (orange-red)
  "#A51A2C",        // fallback
];

export function addHistoricalFloods(m: MLMap, visible: boolean): void {
  if (!m.getSource(HFLOOD_SOURCE)) {
    m.addSource(HFLOOD_SOURCE, {
      type: "geojson",
      data: `${import.meta.env.BASE_URL}flood/historical_floods.geojson`,
      attribution:
        "Historical flood polygons · Copernicus Emergency Management Service " +
        "(EMSR225, EMSR332)",
    });
  }
  if (!m.getLayer(HFLOOD_FILL)) {
    m.addLayer({
      id: HFLOOD_FILL,
      type: "fill",
      source: HFLOOD_SOURCE,
      paint: {
        "fill-color": COLOR_BY_KIND,
        "fill-opacity": 0.28,
      },
    });
  }
  if (!m.getLayer(HFLOOD_LINE)) {
    m.addLayer({
      id: HFLOOD_LINE,
      type: "line",
      source: HFLOOD_SOURCE,
      paint: {
        // Distinct outline colour so polygons read as flood evidence
        // at a glance and don't blur into the red/orange fill — blue
        // reads as "water" and contrasts cleanly against both the
        // hydro-damage orange and the observed-flood red.
        "line-color": "#1E3A8A",
        "line-width": 1.6,
        "line-opacity": 0.95,
      },
    });
  }
  setHistoricalFloodsVisible(m, visible);
}

export function setHistoricalFloodsVisible(m: MLMap, visible: boolean): void {
  const v = visible ? "visible" : "none";
  for (const id of [HFLOOD_FILL, HFLOOD_LINE]) {
    if (m.getLayer(id)) m.setLayoutProperty(id, "visibility", v);
  }
}
