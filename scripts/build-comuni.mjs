#!/usr/bin/env node
// Bake FVG comune (admin_level=8) polygons + per-model mean risk into a
// static GeoJSON for the choropleth layer.
//
// Pipeline:
//   1. Fetch admin_level=8 relations covering FVG from Overpass.
//   2. Assemble relation members (ways) into closed outer rings.
//   3. For each cell in cell_grid_<model>.json, point-in-polygon against
//      every comune; aggregate `mean(p)` per comune per model.
//   4. Emit a single FeatureCollection with `risk_j2` + `risk_j3` per
//      feature so the runtime layer can switch via expression.

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(process.cwd());
const OUT = `${ROOT}/public/data/comuni_fvg.geojson`;

// FVG ISTAT provincial prefixes — Udine, Gorizia, Trieste, Pordenone.
// The Overpass bbox catches neighbouring Veneto/Slovenia/Austria too, so
// we filter on this prefix to keep only the 215 FVG comuni.
const FVG_ISTAT_PREFIX = ["030", "031", "032", "093"];

/** Douglas–Peucker tolerance in degrees ≈ 5 m at FVG latitude. Admin
 *  boundaries are visible at moderate zoom, so the tolerance is tighter
 *  than for roads — a clipped corner reads as a fault. */
const DP_EPS = 5e-5;
const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];
const BBOX = "45.5,12.3,46.65,13.95";
// Standard pattern for assembling admin polygons from Overpass:
//   1. Select the relations.
//   2. Recurse (`>`) to fetch every member way + every node referenced by
//      those ways.
//   3. `out body` gives relations with their member references; `out skel
//      qt` for ways and nodes is the slimmest payload that still has the
//      coords + IDs we need to stitch.
const QUERY = `
[out:json][timeout:180];
(
  relation[boundary=administrative][admin_level=8](${BBOX});
);
out body;
>;
out skel qt;
`;

async function tryFetch(endpoint) {
  console.log(`  → ${endpoint}`);
  const t0 = Date.now();
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": "landslide-app build-comuni/1.0 (https://github.com/diiibe)",
      "accept": "application/json",
    },
    body: new URLSearchParams({ data: QUERY }).toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text.slice(0, 200)}`);
  }
  const json = await res.json();
  console.log(`    ${json.elements?.length ?? 0} relations in ${(Date.now() - t0) / 1000}s`);
  return json;
}

async function fetchOverpass() {
  console.log(`querying overpass for FVG comuni …`);
  let lastErr;
  for (const ep of ENDPOINTS) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try { return await tryFetch(ep); }
      catch (e) {
        lastErr = e;
        console.log(`    attempt ${attempt} failed: ${e.message?.slice(0, 100)}`);
        if (attempt < 3) await new Promise((r) => setTimeout(r, 5000 * attempt));
      }
    }
  }
  throw lastErr ?? new Error("all overpass endpoints failed");
}

const eq = (a, b) => Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;

function perpDistSq(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    const ex = p[0] - a[0];
    const ey = p[1] - a[1];
    return ex * ex + ey * ey;
  }
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lenSq));
  const px = a[0] + t * dx;
  const py = a[1] + t * dy;
  return (p[0] - px) ** 2 + (p[1] - py) ** 2;
}

function douglasPeucker(coords, epsSq) {
  if (coords.length < 3) return coords;
  // Skip the closing duplicate point during simplification, then re-close.
  const closed = eq(coords[0], coords[coords.length - 1]);
  const work = closed ? coords.slice(0, -1) : coords;
  if (work.length < 3) return coords;
  const keep = new Uint8Array(work.length);
  keep[0] = 1;
  keep[work.length - 1] = 1;
  const stack = [[0, work.length - 1]];
  while (stack.length > 0) {
    const [s, e] = stack.pop();
    let maxD = 0, maxI = -1;
    for (let i = s + 1; i < e; i++) {
      const d = perpDistSq(work[i], work[s], work[e]);
      if (d > maxD) { maxD = d; maxI = i; }
    }
    if (maxD > epsSq && maxI !== -1) {
      keep[maxI] = 1;
      stack.push([s, maxI], [maxI, e]);
    }
  }
  const out = [];
  for (let i = 0; i < work.length; i++) if (keep[i]) out.push(work[i]);
  if (closed) out.push(out[0]);
  return out;
}

/**
 * Stitch admin-relation member ways into closed rings.
 * Each `way` arrives as `[ {lon,lat}, ... ]`. We greedily chain them by
 * matching endpoints, optionally reversing a way to fit. Most comuni
 * resolve to a single outer ring; the algorithm handles multiple rings
 * (e.g. enclaves) by restarting with the next unused way.
 */
function stitchRings(ways) {
  const used = new Set();
  const rings = [];
  for (const seed of ways) {
    if (used.has(seed.id)) continue;
    used.add(seed.id);
    const chain = [...seed.coords];
    let progress = true;
    while (progress) {
      const tail = chain[chain.length - 1];
      progress = false;
      for (const w of ways) {
        if (used.has(w.id)) continue;
        if (eq(w.coords[0], tail)) {
          used.add(w.id);
          chain.push(...w.coords.slice(1));
          progress = true;
          break;
        }
        if (eq(w.coords[w.coords.length - 1], tail)) {
          used.add(w.id);
          chain.push(...w.coords.slice(0, -1).reverse());
          progress = true;
          break;
        }
      }
      if (eq(chain[0], chain[chain.length - 1])) break;
    }
    if (chain.length >= 4 && eq(chain[0], chain[chain.length - 1])) {
      rings.push(chain);
    }
  }
  return rings;
}

function bboxOf(ring) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return [minX, minY, maxX, maxY];
}

/** Ray-cast point-in-polygon over an array of rings (outer first). */
function pointInRings(rings, x, y) {
  let inside = false;
  for (const ring of rings) {
    let r = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1];
      const xj = ring[j][0], yj = ring[j][1];
      const intersect =
        ((yi > y) !== (yj > y)) &&
        x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersect) r = !r;
    }
    if (r) inside = !inside;
  }
  return inside;
}

function loadGrid(model) {
  return readFile(`${ROOT}/public/data/cell_grid_${model}.json`, "utf8")
    .then(JSON.parse)
    .then((j) => {
      // Reconstruct (lng,lat,p) tuples from the packed grid.
      const points = [];
      const step = j.step;
      for (let i = 0; i < j.data.length; i += 3) {
        const gx = j.data[i];
        const gy = j.data[i + 1];
        const p = j.data[i + 2];
        // Cell center: (gx+0.5)*step, (gy+0.5)*step.
        points.push([(gx + 0.5) * step, (gy + 0.5) * step, p]);
      }
      return points;
    });
}

async function main() {
  const overpass = await fetchOverpass();
  const [gridJ2, gridJ3] = await Promise.all([loadGrid("j2"), loadGrid("j3")]);
  console.log(`  grid: j2=${gridJ2.length} j3=${gridJ3.length} cells`);

  // Index nodes and ways from the recursive payload so we can assemble
  // each relation's outer ring on demand.
  const nodes = new Map();
  const ways = new Map();
  const relations = [];
  for (const el of overpass.elements ?? []) {
    if (el.type === "node") {
      nodes.set(el.id, [
        Math.round(el.lon * 1e6) / 1e6,
        Math.round(el.lat * 1e6) / 1e6,
      ]);
    } else if (el.type === "way") {
      ways.set(el.id, el.nodes ?? []);
    } else if (el.type === "relation") {
      relations.push(el);
    }
  }
  console.log(`  index: ${nodes.size} nodes, ${ways.size} ways, ${relations.length} relations`);

  const comuni = [];
  for (const rel of relations) {
    const istat = rel.tags?.["ref:ISTAT"];
    if (!istat || !FVG_ISTAT_PREFIX.some((p) => istat.startsWith(p))) continue;
    const outerWayIds = (rel.members ?? [])
      .filter((m) => m.type === "way" && m.role === "outer")
      .map((m) => m.ref);
    if (outerWayIds.length === 0) continue;
    const memberWays = outerWayIds
      .map((id) => {
        const nodeIds = ways.get(id);
        if (!nodeIds) return null;
        const coords = nodeIds.map((nid) => nodes.get(nid)).filter(Boolean);
        if (coords.length < 2) return null;
        return { id, coords };
      })
      .filter(Boolean);
    if (memberWays.length === 0) continue;
    const rawRings = stitchRings(memberWays);
    if (rawRings.length === 0) continue;
    const epsSq = DP_EPS * DP_EPS;
    const rings = rawRings.map((r) => douglasPeucker(r, epsSq));
    const bbox = bboxOf(rings[0]);
    comuni.push({
      id: rel.id,
      name: rel.tags?.name ?? "",
      istat: rel.tags?.["ref:ISTAT"] ?? null,
      rings,
      bbox,
    });
  }
  console.log(`  assembled ${comuni.length} comuni polygons`);

  // Aggregate risk per comune per model.
  const aggregate = (grid) => {
    const sums = new Map(); // comune.id -> { sum, count }
    for (const c of comuni) sums.set(c.id, { sum: 0, count: 0 });
    for (const [x, y, p] of grid) {
      for (const c of comuni) {
        if (x < c.bbox[0] || x > c.bbox[2] || y < c.bbox[1] || y > c.bbox[3]) continue;
        if (!pointInRings(c.rings, x, y)) continue;
        const acc = sums.get(c.id);
        acc.sum += p;
        acc.count += 1;
      }
    }
    return sums;
  };

  console.log(`  aggregating j2 …`);
  const sumsJ2 = aggregate(gridJ2);
  console.log(`  aggregating j3 …`);
  const sumsJ3 = aggregate(gridJ3);

  const features = comuni.map((c) => {
    const a2 = sumsJ2.get(c.id);
    const a3 = sumsJ3.get(c.id);
    const r2 = a2.count > 0 ? a2.sum / a2.count : 0;
    const r3 = a3.count > 0 ? a3.sum / a3.count : 0;
    return {
      type: "Feature",
      id: c.id,
      properties: {
        name: c.name,
        istat: c.istat,
        cells_j2: a2.count,
        cells_j3: a3.count,
        risk_j2: Math.round(r2 * 1000) / 1000,
        risk_j3: Math.round(r3 * 1000) / 1000,
      },
      geometry: {
        type: "Polygon",
        coordinates: c.rings,
      },
    };
  });

  const fc = { type: "FeatureCollection", features };
  const text = JSON.stringify(fc);
  await writeFile(OUT, text);
  const sizeMb = (text.length / (1024 * 1024)).toFixed(2);
  console.log(`wrote ${features.length} comuni (${sizeMb} MB) → ${OUT}`);
}

await main();
