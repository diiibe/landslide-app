import type { ModelId } from "@/app/types";
import { CellGridFileSchema, parseOrThrow } from "@/lib/schemas";

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

/**
 * P2.10 — the cell index packs gx/gy into a 32-bit int (16 bits each),
 * which wraps silently outside [0, 0xffff]. The FVG bbox (gx ∈ [6150,
 * 6975], gy ∈ [22750, 23325] at step 0.002°) fits comfortably, but a
 * future build script change could push triplets out of range and
 * produce undetectable key collisions. Validate at load time.
 */
function assertGridCoord(name: "gx" | "gy", v: number, i: number): void {
  if (!Number.isInteger(v) || v < 0 || v > 0xffff) {
    throw new RangeError(
      `cell_grid: ${name}=${v} at triplet ${i / 3} is outside [0, 65535] — ` +
        `the 16-bit packed key would wrap silently and produce collisions`,
    );
  }
}

export async function loadCellGrid(model: ModelId): Promise<CellGrid> {
  const cached = cache.get(model);
  if (cached) return cached;
  let promise = inFlight.get(model);
  if (!promise) {
    promise = (async () => {
      const url = `${import.meta.env.BASE_URL}data/cell_grid_${model}.json`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`cell_grid_${model}.json: ${res.status}`);
      const raw = (await res.json()) as unknown;
      const json = parseOrThrow(CellGridFileSchema, raw, `cell_grid_${model}.json`);
      const cells = new Map<number, number>();
      for (let i = 0; i < json.data.length; i += 3) {
        const gx = json.data[i] as number;
        const gy = json.data[i + 1] as number;
        const v = json.data[i + 2] as number;
        assertGridCoord("gx", gx, i);
        assertGridCoord("gy", gy, i);
        cells.set((gx << 16) | gy, v);
      }
      const grid: CellGrid = { step: json.step, cells };
      cache.set(model, grid);
      return grid;
    })();
    promise.catch(() => {
      // Surface the rejection but don't poison the in-flight cache: a
      // subsequent retry should be allowed to re-fetch.
      inFlight.delete(model);
    });
    inFlight.set(model, promise);
  }
  return promise;
}

/**
 * Pack a (gx, gy) pair into the same 32-bit key the loader uses. Returns
 * `null` if either coordinate is outside [0, 0xffff] — outside the FVG
 * bbox the 16-bit packing would wrap into a colliding key and return
 * stale risk from an unrelated cell. A null result short-circuits to
 * `risk = 0` at the call site, which is the correct answer for any
 * geometry outside the loaded grid.
 */
function packKey(gx: number, gy: number): number | null {
  if (gx < 0 || gx > 0xffff || gy < 0 || gy > 0xffff) return null;
  return (gx << 16) | gy;
}

export function lookupRiskInGrid(grid: CellGrid, lng: number, lat: number): number {
  const gx = Math.floor(lng / grid.step);
  const gy = Math.floor(lat / grid.step);
  const k = packKey(gx, gy);
  if (k === null) return 0;
  return grid.cells.get(k) ?? 0;
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
      const k = packKey(cx + dx, cy + dy);
      if (k === null) continue;
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
