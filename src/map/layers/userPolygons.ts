/**
 * Render saved user-drawn polygons on the map. Each entry becomes a
 * fill + outline pair tinted with the polygon's stored color. Click on
 * the fill opens a stats popup so the user can re-read their saved
 * numbers.
 *
 * The whole collection is fed into ONE shared source as a single
 * FeatureCollection so reconciliation on add/remove is just a setData
 * call — no per-id source churn.
 */

import maplibregl, {
  type Map as MLMap,
  type ExpressionSpecification,
  type GeoJSONSource,
  type MapMouseEvent,
} from "maplibre-gl";
import type { UserPolygon } from "@/app/types";

export const USER_POLY_SOURCE = "user-polygons";
export const USER_POLY_FILL = "user-polygons-fill";
export const USER_POLY_LINE = "user-polygons-line";

function toFeatureCollection(polygons: UserPolygon[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: polygons.map((p) => ({
      type: "Feature",
      properties: {
        id: p.id,
        name: p.name,
        color: p.color,
        areaKm2: p.stats.areaKm2,
        cellsVisible: p.stats.cellsVisible,
        cellsAboveThreshold: p.stats.cellsAboveThreshold,
        meanP: p.stats.meanP,
        medianP: p.stats.medianP,
        iffiCount: p.stats.iffiCount,
        threshold: p.stats.threshold,
        model: p.stats.model,
      },
      geometry: p.geometry,
    })),
  };
}

export function setupUserPolygons(m: MLMap, polygons: UserPolygon[]): void {
  if (m.getLayer(USER_POLY_FILL)) m.removeLayer(USER_POLY_FILL);
  if (m.getLayer(USER_POLY_LINE)) m.removeLayer(USER_POLY_LINE);
  if (m.getSource(USER_POLY_SOURCE)) m.removeSource(USER_POLY_SOURCE);

  m.addSource(USER_POLY_SOURCE, {
    type: "geojson",
    data: toFeatureCollection(polygons),
  });

  const colorExpr: ExpressionSpecification = [
    "coalesce",
    ["get", "color"],
    "#FFD400",
  ];

  m.addLayer({
    id: USER_POLY_FILL,
    type: "fill",
    source: USER_POLY_SOURCE,
    paint: {
      "fill-color": colorExpr,
      "fill-opacity": 0.18,
      "fill-outline-color": "rgba(0,0,0,0)",
    },
  });

  m.addLayer({
    id: USER_POLY_LINE,
    type: "line",
    source: USER_POLY_SOURCE,
    paint: {
      "line-color": colorExpr,
      "line-width": 2.5,
      "line-opacity": 0.95,
    },
  });
}

export function updateUserPolygonsData(m: MLMap, polygons: UserPolygon[]): void {
  const src = m.getSource(USER_POLY_SOURCE) as GeoJSONSource | undefined;
  if (!src) return;
  src.setData(toFeatureCollection(polygons));
  // setData is asynchronous on some MapLibre code paths; force a paint
  // tick so the removed polygon's geometry actually disappears on the
  // next frame instead of waiting for the next user interaction.
  m.triggerRepaint();
}

/** Build the stats popup card for a saved polygon. Used both when the
 *  user clicks the fill on the map and when a row in the LayersPanel
 *  Saved areas section dispatches `fvg:show-polygon-stats`. */
export function buildPolygonStatsNode(p: UserPolygon): HTMLElement {
  const root = document.createElement("div");
  root.className = "fvg-popup fvg-popup--polygon";

  const title = document.createElement("div");
  title.className = "fvg-popup__title";
  title.textContent = p.name;
  root.appendChild(title);

  const meta = document.createElement("div");
  meta.className = "fvg-popup__muted fvg-popup__meta";
  meta.textContent = `${p.stats.model.toUpperCase()} · saved at p ≥ ${p.stats.threshold.toFixed(2)}`;
  root.appendChild(meta);

  const dl = document.createElement("dl");
  dl.className = "fvg-popup__stats";

  const row = (label: string, value: string) => {
    const dt = document.createElement("dt");
    dt.className = "fvg-popup__muted";
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.className = "fvg-popup__statValue";
    dd.textContent = value;
    dl.append(dt, dd);
  };
  row("Area", `${p.stats.areaKm2.toFixed(2)} km²`);
  row("Cells", `${p.stats.cellsVisible}`);
  row("Above thr", `${p.stats.cellsAboveThreshold}`);
  row("Mean p", p.stats.meanP.toFixed(3));
  row("Median p", p.stats.medianP.toFixed(3));
  row("IFFI", `${p.stats.iffiCount}`);
  root.appendChild(dl);
  return root;
}

/** Bind a click handler that opens the stats popup when the user taps
 *  a saved polygon. Returns an unsubscribe. */
export function registerPolygonClicks(
  m: MLMap,
  lookup: () => UserPolygon[],
): () => void {
  const onClick = (e: MapMouseEvent) => {
    if (!m.getLayer(USER_POLY_FILL)) return;
    const feats = m.queryRenderedFeatures(e.point, { layers: [USER_POLY_FILL] });
    const feat = feats[0];
    if (!feat) return;
    const id = feat.properties?.id as string | undefined;
    if (!id) return;
    const polygon = lookup().find((p) => p.id === id);
    if (!polygon) return;
    new maplibregl.Popup({
      closeButton: true,
      closeOnClick: true,
      offset: 8,
      className: "feature-popup",
      maxWidth: "260px",
    })
      .setLngLat(e.lngLat)
      .setDOMContent(buildPolygonStatsNode(polygon))
      .addTo(m);
  };
  m.on("click", USER_POLY_FILL, onClick);
  return () => m.off("click", USER_POLY_FILL, onClick);
}

/** Programmatic popup opener — used by the LayersPanel "Saved areas"
 *  row click via the `fvg:show-polygon-stats` window event. */
export function openPolygonPopup(m: MLMap, polygon: UserPolygon): void {
  const cx = (polygon.bounds[0][0] + polygon.bounds[1][0]) / 2;
  const cy = (polygon.bounds[0][1] + polygon.bounds[1][1]) / 2;
  new maplibregl.Popup({
    closeButton: true,
    closeOnClick: true,
    offset: 8,
    className: "feature-popup",
    maxWidth: "260px",
  })
    .setLngLat([cx, cy])
    .setDOMContent(buildPolygonStatsNode(polygon))
    .addTo(m);
}
