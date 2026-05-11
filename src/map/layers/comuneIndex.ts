/**
 * Comune autocomplete index. Reads the same comuni_fvg.geojson the
 * choropleth uses, computes a bbox per feature once, exposes a typed
 * list keyed by ISTAT code for the ComuneFilterPanel.
 *
 * Single shared promise → no double-fetch with the map layer.
 */
import { loadComuni } from "./comuni";

export interface ComuneEntry {
  istat: string;
  name: string;
  riskJ2: number;
  riskJ3: number;
  /** [[minLng, minLat], [maxLng, maxLat]] in WGS84. */
  bounds: [[number, number], [number, number]];
}

let indexCache: Promise<ComuneEntry[]> | null = null;

export function getComuneIndex(): Promise<ComuneEntry[]> {
  if (!indexCache) {
    indexCache = (async () => {
      const fc = await loadComuni();
      const out: ComuneEntry[] = [];
      for (const feat of fc.features) {
        const props = (feat.properties ?? {}) as Record<string, unknown>;
        const istat = String(props.istat ?? "");
        const name = String(props.name ?? "");
        if (!istat || !name) continue;
        const bounds = featureBounds(feat.geometry);
        if (!bounds) continue;
        out.push({
          istat,
          name,
          riskJ2: Number(props.risk_j2 ?? 0),
          riskJ3: Number(props.risk_j3 ?? 0),
          bounds,
        });
      }
      // Sort by name (Italian collation) so autocomplete results have a
      // stable order. Bilingual names like "Sappada / Plodn / Sapade"
      // sort by their leading segment, which is the right default.
      out.sort((a, b) => a.name.localeCompare(b.name, "it"));
      return out;
    })();
  }
  return indexCache;
}

/** Compute the union bounds of the listed ISTAT codes. Returns null if
 *  no codes match (caller decides whether to no-op the flyTo). */
export async function unionBounds(
  istatCodes: string[],
): Promise<[[number, number], [number, number]] | null> {
  if (istatCodes.length === 0) return null;
  const idx = await getComuneIndex();
  const wanted = new Set(istatCodes);
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  let hits = 0;
  for (const e of idx) {
    if (!wanted.has(e.istat)) continue;
    hits++;
    if (e.bounds[0][0] < west) west = e.bounds[0][0];
    if (e.bounds[0][1] < south) south = e.bounds[0][1];
    if (e.bounds[1][0] > east) east = e.bounds[1][0];
    if (e.bounds[1][1] > north) north = e.bounds[1][1];
  }
  if (hits === 0) return null;
  return [[west, south], [east, north]];
}

function featureBounds(
  geom: GeoJSON.Geometry | null,
): [[number, number], [number, number]] | null {
  if (!geom) return null;
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  const visit = (coord: number[]) => {
    const lng = coord[0];
    const lat = coord[1];
    if (typeof lng !== "number" || typeof lat !== "number") return;
    if (lng < west) west = lng;
    if (lng > east) east = lng;
    if (lat < south) south = lat;
    if (lat > north) north = lat;
  };
  switch (geom.type) {
    case "Polygon":
      for (const ring of geom.coordinates) for (const c of ring) visit(c);
      break;
    case "MultiPolygon":
      for (const poly of geom.coordinates)
        for (const ring of poly) for (const c of ring) visit(c);
      break;
    default:
      // Comuni are always polygonal in FVG; bail out silently on anything
      // else rather than crash the autocomplete index over one bad row.
      return null;
  }
  if (!isFinite(west) || !isFinite(south) || !isFinite(east) || !isFinite(north)) {
    return null;
  }
  return [[west, south], [east, north]];
}
