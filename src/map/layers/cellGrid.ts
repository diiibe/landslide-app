import type { ModelId } from "@/app/types";

/**
 * Static cell-risk grid loaded from `public/data/cell_grid_<model>.json`.
 * Built at dev time from the centroids pmtiles (`scripts/build-cell-grid.mjs`)
 * and bucketed to a 0.002° (~220 m) grid. Look-up of `p` for any lng/lat
 * is a single `Map.get` — deterministic and zoom-independent.
 *
 * Two networks (roads, trails) share this loader, so the cache below
 * serves both with a single fetch per model.
 */
export interface CellGrid {
  step: number;
  cells: Map<number, number>;
}

const cache = new Map<ModelId, CellGrid>();
const inFlight = new Map<ModelId, Promise<CellGrid>>();

export async function loadCellGrid(model: ModelId): Promise<CellGrid> {
  const cached = cache.get(model);
  if (cached) return cached;
  let promise = inFlight.get(model);
  if (!promise) {
    promise = (async () => {
      const url = `${import.meta.env.BASE_URL}data/cell_grid_${model}.json`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`cell_grid_${model}.json: ${res.status}`);
      const json = (await res.json()) as { step: number; data: number[] };
      const cells = new Map<number, number>();
      for (let i = 0; i < json.data.length; i += 3) {
        const gx = json.data[i] as number;
        const gy = json.data[i + 1] as number;
        const v = json.data[i + 2] as number;
        cells.set(((gx & 0xffff) << 16) | (gy & 0xffff), v);
      }
      const grid: CellGrid = { step: json.step, cells };
      cache.set(model, grid);
      return grid;
    })();
    inFlight.set(model, promise);
  }
  return promise;
}

export function lookupRiskInGrid(grid: CellGrid, lng: number, lat: number): number {
  const gx = Math.floor(lng / grid.step);
  const gy = Math.floor(lat / grid.step);
  return grid.cells.get(((gx & 0xffff) << 16) | (gy & 0xffff)) ?? 0;
}

/**
 * Per-vertex max p inside a square buffer of (2R+1)² grid cells around
 * the projected coordinate. R=0 reduces to the single-cell lookup.
 */
function bufferMaxP(grid: CellGrid, lng: number, lat: number, radius: number): number {
  if (radius <= 0) return lookupRiskInGrid(grid, lng, lat);
  const cx = Math.floor(lng / grid.step);
  const cy = Math.floor(lat / grid.step);
  let m = 0;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const k = (((cx + dx) & 0xffff) << 16) | ((cy + dy) & 0xffff);
      const v = grid.cells.get(k);
      if (v !== undefined && v > m) m = v;
    }
  }
  return m;
}

/**
 * Walk every line geometry in the collection and stamp `risk` per feature.
 *
 * Pipeline per vertex: (1) max p inside a `(2R+1)²` cell buffer, (2) apply
 * the gamma exponent. Across vertices we still take the max — a road that
 * runs through truly hot terrain anywhere should read as risky. Gamma is
 * the dial that controls *what counts as truly hot*: γ>1 squashes mid p
 * toward 0, so only well-above-baseline cells light the road up.
 */
export function bakeRiskIntoFeatures(
  network: GeoJSON.FeatureCollection,
  grid: CellGrid,
  opts: { gamma: number; radius: number },
): GeoJSON.FeatureCollection {
  const { gamma, radius } = opts;
  const out: GeoJSON.Feature[] = [];
  const sample = (c: GeoJSON.Position) => {
    const raw = bufferMaxP(grid, c[0] as number, c[1] as number, radius);
    return Math.pow(raw, gamma);
  };
  for (const f of network.features) {
    const g = f.geometry;
    if (!g || (g.type !== "LineString" && g.type !== "MultiLineString")) continue;
    let maxP = 0;
    if (g.type === "LineString") {
      for (const c of g.coordinates) {
        const v = sample(c);
        if (v > maxP) maxP = v;
      }
    } else {
      for (const seg of g.coordinates) {
        for (const c of seg) {
          const v = sample(c);
          if (v > maxP) maxP = v;
        }
      }
    }
    out.push({
      ...f,
      properties: { ...(f.properties ?? {}), risk: maxP },
    });
  }
  return { type: "FeatureCollection", features: out };
}
