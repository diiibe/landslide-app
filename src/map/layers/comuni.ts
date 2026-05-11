import type { Map as MLMap, GeoJSONSource } from "maplibre-gl";
import { useAppStore } from "@/app/store";
import type { ModelId } from "@/app/types";

/**
 * Comune-level choropleth.
 *
 * Static data source: `public/data/comuni_fvg.geojson`. Each feature has
 * `risk_j2` and `risk_j3` (mean p over the comune's cell grid coverage)
 * baked at build time by `scripts/build-comuni.mjs` — no runtime polygon
 * aggregation needed.
 *
 * Two layers stacked: a low-opacity fill for the gradient and a thin
 * outline so adjacent comuni stay distinguishable. The fill expression
 * references `risk_j2` or `risk_j3` depending on the active model;
 * switching models is a `setPaintProperty` call.
 */

export const COMUNI_SOURCE = "comuni-static";
export const COMUNI_FILL = "comuni-fill";
export const COMUNI_LINE = "comuni-line";

const DATA_URL_KEY = "comuni_fvg.geojson";

let comuniRaw: GeoJSON.FeatureCollection | null = null;
let comuniInFlight: Promise<GeoJSON.FeatureCollection> | null = null;

async function loadComuni(): Promise<GeoJSON.FeatureCollection> {
  if (comuniRaw) return comuniRaw;
  if (!comuniInFlight) {
    comuniInFlight = (async () => {
      const url = `${import.meta.env.BASE_URL}data/${DATA_URL_KEY}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${DATA_URL_KEY}: ${res.status}`);
      return (await res.json()) as GeoJSON.FeatureCollection;
    })();
  }
  comuniRaw = await comuniInFlight;
  return comuniRaw;
}

/** Choropleth gradient — hue follows the established susceptibility palette
 *  but on a polygon-mean p (which is concentrated in [0, 0.4] for FVG). */
function fillColor(model: ModelId): unknown {
  const prop = model === "j2" ? "risk_j2" : "risk_j3";
  return [
    "interpolate", ["linear"],
    ["coalesce", ["get", prop], 0],
    0.00, "rgba(232,240,216,0.55)",
    0.05, "rgba(180,210,160,0.60)",
    0.12, "rgba(217,164,65,0.65)",
    0.22, "rgba(210,85,36,0.72)",
    0.35, "rgba(160,30,30,0.80)",
    0.50, "rgba(85,12,15,0.88)",
  ];
}

export function addComuni(m: MLMap, visible: boolean, dark = false): void {
  for (const id of [COMUNI_FILL, COMUNI_LINE]) {
    if (m.getLayer(id)) m.removeLayer(id);
  }
  if (m.getSource(COMUNI_SOURCE)) m.removeSource(COMUNI_SOURCE);

  m.addSource(COMUNI_SOURCE, {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });

  const model = useAppStore.getState().model;
  // Comune outlines need higher contrast on the dark basemap; in light
  // mode the existing warm-grey reads fine over the cream paper.
  const outline = dark ? "rgba(232,224,210,0.45)" : "rgba(60,55,40,0.55)";

  m.addLayer({
    id: COMUNI_FILL,
    type: "fill",
    source: COMUNI_SOURCE,
    paint: {
      "fill-color": fillColor(model) as never,
      "fill-outline-color": "rgba(0,0,0,0)",
    },
    layout: { visibility: visible ? "visible" : "none" },
  });

  m.addLayer({
    id: COMUNI_LINE,
    type: "line",
    source: COMUNI_SOURCE,
    paint: {
      "line-color": outline,
      "line-width": 0.6,
    },
    layout: { visibility: visible ? "visible" : "none" },
  });

  void loadComuni().then((fc) => {
    const src = m.getSource(COMUNI_SOURCE) as GeoJSONSource | undefined;
    src?.setData(fc);
  });
}

export function setComuniVisible(m: MLMap, v: boolean): void {
  for (const id of [COMUNI_FILL, COMUNI_LINE]) {
    if (m.getLayer(id)) m.setLayoutProperty(id, "visibility", v ? "visible" : "none");
  }
}

export function applyComuniModel(m: MLMap): void {
  if (!m.getLayer(COMUNI_FILL)) return;
  const model = useAppStore.getState().model;
  m.setPaintProperty(COMUNI_FILL, "fill-color", fillColor(model) as never);
}
