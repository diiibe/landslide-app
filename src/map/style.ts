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
  dark: `https://api.mapbox.com/styles/v1/mapbox/dark-v11?access_token=${TOKEN}`,
};

export const FVG_BOUNDS: [[number, number], [number, number]] = [
  [12.3, 45.5],
  [13.95, 46.65],
];

/** Default view: Carnia / Friuli montano — the area where the susceptibility
 *  signal is densest and the road risk overlay actually has something to show.
 *  The full FVG bounds (FVG_BOUNDS) still constrain panning. */
export const FVG_CENTER: [number, number] = [13.15, 46.35];

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

function lerpHex(a: string, b: string, t: number): string {
  const ax = parseInt(a.slice(1), 16);
  const bx = parseInt(b.slice(1), 16);
  const ar = (ax >> 16) & 0xff;
  const ag = (ax >> 8) & 0xff;
  const ab = ax & 0xff;
  const br = (bx >> 16) & 0xff;
  const bg = (bx >> 8) & 0xff;
  const bb = bx & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return "#" + ((r << 16) | (g << 8) | bl).toString(16).padStart(6, "0").toUpperCase();
}

/**
 * Linear interpolation across `RAMP_STOPS` for `p ∈ [0, 1]`. Single source
 * of truth so the histogram bars in the analytics panel stay aligned with
 * the map's heat ramp (P3 nit). Out-of-range inputs are clamped.
 */
export function rampColorAt(p: number): string {
  const first = RAMP_STOPS[0]!;
  const last = RAMP_STOPS[RAMP_STOPS.length - 1]!;
  if (p <= first[0]) return first[1];
  if (p >= last[0]) return last[1];
  for (let i = 0; i < RAMP_STOPS.length - 1; i++) {
    const lo = RAMP_STOPS[i]!;
    const hi = RAMP_STOPS[i + 1]!;
    if (p <= hi[0]) {
      const t = (p - lo[0]) / (hi[0] - lo[0]);
      return lerpHex(lo[1], hi[1], t);
    }
  }
  return last[1];
}
