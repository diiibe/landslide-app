import type { Basemap } from "@/app/types";

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;

/**
 * Full Mapbox Styles API URLs (not `mapbox://...` because MapLibre GL JS
 * does not support Mapbox's proprietary protocol). The user's token is
 * embedded at build time.
 */
export const BASEMAP_STYLE: Record<Basemap, string> = {
  outdoors: `https://api.mapbox.com/styles/v1/mapbox/outdoors-v12?access_token=${TOKEN}`,
  light: `https://api.mapbox.com/styles/v1/mapbox/light-v11?access_token=${TOKEN}`,
  satellite: `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12?access_token=${TOKEN}`,
};

export const FVG_BOUNDS: [[number, number], [number, number]] = [
  [12.3, 45.5],
  [13.95, 46.65],
];

export const FVG_CENTER: [number, number] = [13.1, 46.15];

/** 5-stop ramp mapped to MapLibre `interpolate` paint expression. */
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
