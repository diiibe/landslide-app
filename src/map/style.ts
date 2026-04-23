import type { Basemap } from "@/app/types";

export const BASEMAP_STYLE: Record<Basemap, string> = {
  outdoors: "mapbox://styles/mapbox/outdoors-v12",
  light: "mapbox://styles/mapbox/light-v11",
  satellite: "mapbox://styles/mapbox/satellite-streets-v12",
};

export const FVG_BOUNDS: [[number, number], [number, number]] = [
  [12.3, 45.5],
  [13.95, 46.65],
];

export const FVG_CENTER: [number, number] = [13.1, 46.15];

/** 5-stop ramp mapped to Mapbox `interpolate` paint expression. */
export const RAMP_STOPS: Array<[number, string]> = [
  [0.0, "#E8F0D8"],
  [0.25, "#8BB26B"],
  [0.5, "#D9A441"],
  [0.75, "#D25524"],
  [1.0, "#7A1F10"],
];

export function rampPaint(): unknown {
  return [
    "interpolate",
    ["linear"],
    ["get", "p"],
    ...RAMP_STOPS.flat(),
  ];
}
