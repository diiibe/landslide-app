import { rampColor, type ColorStop } from "@/map/hoverCard";
import { DIRECTION_IMAGE, directionSize } from "./directionIcon";
import type {
  ExpressionSpecification as Expr,
  LayerSpecification,
} from "maplibre-gl";
import type { LayerDefinition } from "./types";
import { presentation, type DisplayMode } from "./presentation";
import { metricRange } from "./data";

export const OVERVIEW_ZOOM = 11;
export const layerSuffixes = [
  "fill",
  "casing",
  "line",
  "halo",
  "point",
  "labels",
  "groups",
  "counts",
  "density",
  "overview",
  "overview-counts",
  "overview-density",
  "direction",
];
export function metricStops(
  l: LayerDefinition,
  data?: GeoJSON.FeatureCollection,
): ColorStop[] | null {
  const p = presentation(l),
    range = !p.local && p.type !== "direction" ? metricRange(l, data) : null;
  return range
    ? [
        [range[0], p.colors[0]],
        [
          !l.pcrVariable && range[0] < 0 && range[1] > 0
            ? 0
            : (range[0] + range[1]) / 2,
          p.colors[1],
        ],
        [range[1], p.colors[2]],
      ]
    : null;
}
export function metricColor(
  l: LayerDefinition,
  data?: GeoJSON.FeatureCollection,
): string | Expr {
  if (!l.metric) return l.color;
  const stops = metricStops(l, data);
  return [
    "case",
    [
      "any",
      ["==", ["get", "__invalidTime"], true],
      ["==", ["get", "__censored"], true],
      ["in", ["get", "qualita_qc"], ["literal", [3, 4]]],
      ["!=", ["typeof", ["get", l.metric.field]], "number"],
    ],
    "#8c938b",
    stops
      ? ["interpolate", ["linear"], ["get", l.metric.field], ...stops.flat()]
      : l.color,
  ] as Expr;
}
export function metricTone(
  l: LayerDefinition,
  p: Record<string, unknown>,
  data?: GeoJSON.FeatureCollection,
) {
  if (!l.metric || p.cluster || p.__overview) return l.color;
  if (
    p.__invalidTime === true ||
    p.__censored === true ||
    [3, 4].includes(p.qualita_qc as number) ||
    typeof p[l.metric.field] !== "number"
  )
    return "#8c938b";
  const stops = metricStops(l, data);
  return stops ? rampColor(stops, Number(p[l.metric.field])) : l.color;
}
const zoom = (a: number, b: number): Expr => [
  "interpolate",
  ["linear"],
  ["zoom"],
  5,
  a,
  14,
  b,
];
export function regionalStyle(
  l: LayerDefinition,
  opacity: number,
  mode: DisplayMode,
  fonts: string[],
  data?: GeoJSON.FeatureCollection,
  slice?: string,
): LayerSpecification[] {
  const src = "regional-" + l.id,
    p = presentation(l),
    color = metricColor(l, data);
  const sourceLayer =
    l.kind === "vector" ? { "source-layer": l.sourceLayer ?? "data" } : {};
  const common = { source: src, ...sourceLayer };
  const clustered = p.clustered && mode === "auto";
  const filter = (types: string[]): Expr => {
    const clauses: Expr[] = [["match", ["geometry-type"], types, true, false]];
    if (slice) clauses.push(["==", ["to-string", ["get", "__depth"]], slice]);
    if (clustered) clauses.push(["!", ["has", "point_count"]]);
    return ["all", ...clauses];
  };
  const point = filter(["Point", "MultiPoint"]);
  const styles: LayerSpecification[] = [
    {
      id: src + "-fill",
      type: "fill",
      ...common,
      filter: filter(["Polygon", "MultiPolygon"]),
      paint: { "fill-color": color, "fill-opacity": opacity },
    },
    {
      id: src + "-casing",
      type: "line",
      ...common,
      filter: filter(["LineString", "MultiLineString"]),
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "#f6f5ed",
        "line-width": zoom(2.4, 5),
        "line-opacity": opacity * 0.8,
      },
    },
    {
      id: src + "-line",
      type: "line",
      ...common,
      filter: filter([
        "LineString",
        "MultiLineString",
        "Polygon",
        "MultiPolygon",
      ]),
      paint: {
        "line-color": l.color,
        "line-width": zoom(0.7, 2.2),
        "line-opacity": Math.min(1, opacity * 1.6),
      },
    },
    {
      id: src + "-halo",
      type: "circle",
      ...common,
      filter: point,
      paint: {
        "circle-color": "#f6f5ed",
        "circle-radius": zoom(8, 11),
        "circle-opacity": opacity * 0.3,
      },
    },
    {
      id: src + "-point",
      type: "circle",
      ...common,
      filter: point,
      ...(l.overview?.kind === "registry" && mode !== "points"
        ? { minzoom: OVERVIEW_ZOOM }
        : {}),
      paint: {
        "circle-color": color,
        "circle-radius":
          p.type === "earthquake"
            ? [
                "interpolate",
                ["linear"],
                ["coalesce", ["get", "__value"], 0],
                0,
                4,
                3,
                11,
                6,
                25,
              ]
            : zoom(4.8, 7.5),
        "circle-opacity": opacity,
        "circle-stroke-color": "#172d25",
        "circle-stroke-width": 1.2,
      },
    },
  ];
  if (l.overview?.kind === "registry" && mode !== "points")
    styles.find((v) => v.id.endsWith("-halo"))!.minzoom = OVERVIEW_ZOOM;
  if (p.type === "measurement" || p.type === "earthquake")
    styles.push({
      id: src + "-labels",
      type: "symbol",
      ...common,
      filter: point,
      minzoom: (l.count ?? 99) <= 5 ? 5 : 10,
      layout: {
        "text-field": [
          "concat",
          ["coalesce", ["get", "__mapLabel"], ["get", "__displayValue"], ""],
          " ",
          ["coalesce", ["get", "__unit"], l.metric?.unit ?? ""],
        ],
        "text-font": fonts,
        "text-size": 12,
        "text-max-width": 10,
        "text-offset": [0, 1.35],
        "text-anchor": "top",
      },
      paint: {
        "text-color": "#172d25",
        "text-halo-color": "#f6f5ed",
        "text-halo-width": 2,
        "text-opacity": opacity,
      },
    });
  if (p.type === "direction")
    styles.push({
      id: src + "-direction",
      type: "symbol",
      ...common,
      filter: [
        "all",
        point,
        ["==", ["typeof", ["get", "__value"]], "number"],
        ["!=", ["get", "__invalidTime"], true],
        ["!=", ["get", "__censored"], true],
        ["!", ["in", ["get", "qualita_qc"], ["literal", [3, 4]]]],
        [">=", ["get", "__value"], 0],
        ["<=", ["get", "__value"], 360],
      ],
      layout: {
        "icon-image": DIRECTION_IMAGE,
        "icon-size": directionSize(),
        "icon-rotate": ["get", "__value"],
        "icon-rotation-alignment": "map",
        "icon-pitch-alignment": "viewport",
      },
      paint: { "icon-opacity": opacity },
    });
  const grouped = (
    source: string,
    property: "point_count" | "__count",
    overview: boolean,
  ) => {
    const id = src + (overview ? "-overview" : "-groups"),
      count: Expr = ["get", property];
    const density = mode === "density",
      areas = overview && l.overview?.kind === "areas";
    if (!density) {
      styles.push({
        id,
        type: "circle",
        source,
        ...(overview
          ? { maxzoom: l.overview?.detailZoom ?? OVERVIEW_ZOOM }
          : { filter: ["has", property] as Expr }),
        paint: {
          "circle-radius": areas
            ? ["step", count, 6, 2, 14, 10, 17, 100, 22, 1000, 27]
            : ["step", count, 13, 10, 17, 100, 22, 1000, 27],
          "circle-color": l.color,
          "circle-stroke-color": areas
            ? ["case", ["==", count, 1], l.color, "#172d25"]
            : "#172d25",
          "circle-stroke-width": 1.5,
          "circle-opacity": areas
            ? ["case", ["==", count, 1], opacity * 0.15, opacity]
            : opacity,
        },
      });
      styles.push({
        id: src + (overview ? "-overview-counts" : "-counts"),
        type: "symbol",
        source,
        ...(areas ? { filter: [">", count, 1] as Expr } : {}),
        ...(overview
          ? { maxzoom: l.overview?.detailZoom ?? OVERVIEW_ZOOM }
          : { filter: ["has", property] as Expr }),
        layout: {
          "text-field": [
            "number-format",
            count,
            { locale: "it-IT", "max-fraction-digits": 0 },
          ],
          "text-font": fonts,
          "text-size": 12,
          "text-allow-overlap": true,
        },
        paint: {
          "text-color": "#172d25",
          "text-halo-color": "#f6f5ed",
          "text-halo-width": 1.5,
          "text-opacity": opacity,
        },
      });
    }
    if (density)
      styles.push({
        id: src + (overview ? "-overview-density" : "-density"),
        type: "heatmap",
        source,
        maxzoom: OVERVIEW_ZOOM + 1,
        paint: {
          "heatmap-weight": overview
            ? ["/", count, l.overview?.maxCount ?? 1]
            : 1,
          "heatmap-intensity": 0.8,
          "heatmap-radius": zoom(18, 32),
          "heatmap-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            9,
            opacity * 0.8,
            OVERVIEW_ZOOM + 1,
            0,
          ],
          "heatmap-color": [
            "interpolate",
            ["linear"],
            ["heatmap-density"],
            0,
            "rgba(0,0,0,0)",
            0.15,
            p.colors[0],
            0.6,
            p.colors[1],
            1,
            p.colors[2],
          ],
        },
      });
  };
  if (clustered) grouped(src, "point_count", false);
  if (mode === "density" && p.density && l.kind === "geojson") {
    grouped(src, "__count", false);
    // Keep precise individual points when the density fades away.
    for (const style of styles)
      if (style.id.endsWith("-point") || style.id.endsWith("-halo"))
        style.minzoom = OVERVIEW_ZOOM;
  }
  if (l.overview && mode !== "points")
    grouped(src + "-overview-source", "__count", true);
  // Do not fetch heavy primary vector tiles merely for empty fill/line layers
  // while the complete, lightweight navigation overview is in use.
  if (l.overview?.kind === "registry" && mode !== "points")
    for (const style of styles)
      if ("source" in style && style.source === src)
        style.minzoom = OVERVIEW_ZOOM;
  return styles;
}
