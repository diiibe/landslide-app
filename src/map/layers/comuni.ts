import type {
  Map as MLMap,
  GeoJSONSource,
  ExpressionSpecification,
} from "maplibre-gl";
import { useAppStore } from "@/app/store";
import type { ModelId } from "@/app/types";
import { ComuneFeatureCollectionSchema, parseOrThrow } from "@/lib/schemas";

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

export async function loadComuni(): Promise<GeoJSON.FeatureCollection> {
  if (comuniRaw) return comuniRaw;
  if (!comuniInFlight) {
    comuniInFlight = (async () => {
      const url = `${import.meta.env.BASE_URL}data/${DATA_URL_KEY}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${DATA_URL_KEY}: ${res.status}`);
      const raw = (await res.json()) as unknown;
      // Validated to the schema, then re-typed as the GeoJSON DOM type
      // MapLibre expects. The zod schema keeps `geometry` as unknown
      // because validating polygons here is heavy and MapLibre will
      // reject malformed geometry with a clear error of its own.
      const parsed = parseOrThrow(ComuneFeatureCollectionSchema, raw, DATA_URL_KEY);
      return parsed as unknown as GeoJSON.FeatureCollection;
    })();
  }
  comuniRaw = await comuniInFlight;
  return comuniRaw;
}

/** Choropleth gradient — hue follows the established susceptibility palette
 *  but on a polygon-mean p (which is concentrated in [0, 0.4] for FVG). */
function fillColor(model: ModelId): ExpressionSpecification {
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

/** Outline that stays legible on both light and dark basemaps. The
 *  default keeps today's warm-grey color so existing callers (which
 *  don't pass `dark`) render identically. */
function outlineColor(dark: boolean): string {
  return dark ? "rgba(240,230,200,0.45)" : "rgba(60,55,40,0.55)";
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

  m.addLayer({
    id: COMUNI_FILL,
    type: "fill",
    source: COMUNI_SOURCE,
    paint: {
      "fill-color": fillColor(model),
      "fill-outline-color": "rgba(0,0,0,0)",
    },
    layout: { visibility: visible ? "visible" : "none" },
  });

  m.addLayer({
    id: COMUNI_LINE,
    type: "line",
    source: COMUNI_SOURCE,
    paint: {
      "line-color": outlineColor(dark),
      "line-width": 0.6,
    },
    layout: { visibility: visible ? "visible" : "none" },
  });

  void loadComuni().then((fc) => {
    const src = m.getSource(COMUNI_SOURCE) as GeoJSONSource | undefined;
    src?.setData(fc);
  });

  // Apply any existing selection filter on initial add — covers the
  // case where the user had a non-empty selection before the layer was
  // mounted (e.g. toggling the layer off and back on).
  applyComuniFilter(m, useAppStore.getState().selectedComuni);
}

export function setComuniVisible(m: MLMap, v: boolean): void {
  for (const id of [COMUNI_FILL, COMUNI_LINE]) {
    if (m.getLayer(id)) m.setLayoutProperty(id, "visibility", v ? "visible" : "none");
  }
}

export function applyComuniModel(m: MLMap): void {
  if (!m.getLayer(COMUNI_FILL)) return;
  const model = useAppStore.getState().model;
  m.setPaintProperty(COMUNI_FILL, "fill-color", fillColor(model));
}

/**
 * Filter both comuni layers to the listed ISTAT codes. Empty list = no
 * filter (every comune visible). Called reactively from MapView when
 * `selectedComuni` changes in the store.
 */
export function applyComuniFilter(m: MLMap, istatCodes: readonly string[]): void {
  const filter: ExpressionSpecification | null =
    istatCodes.length === 0
      ? null
      : ["in", ["get", "istat"], ["literal", [...istatCodes]]];
  for (const id of [COMUNI_FILL, COMUNI_LINE]) {
    if (m.getLayer(id)) m.setFilter(id, filter);
  }
}
