#!/usr/bin/env node
// Bake FVG roads + trails from OpenStreetMap into static GeoJSON files.
//
// We can't use Mapbox Streets vector tiles for risk-tinted lines: tile
// generalization shifts geometry per zoom level, so the same physical
// road samples different cells of our static risk grid at different zooms.
// A canonical, zoom-independent dataset fixes this.
//
// Two outputs, two layers in the app:
//   - roads_fvg.geojson  → motorway → service (visible at low/mid zoom)
//   - trails_fvg.geojson → path / track / footway / bridleway / cycleway
//
// Usage: node scripts/build-roads.mjs

import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(process.cwd());
const OUT_DIR = `${ROOT}/public/data`;
const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

// FVG_BOUNDS in style.ts: [[12.3, 45.5], [13.95, 46.65]] (lng,lat).
// Overpass wants south,west,north,east.
const BBOX = "45.5,12.3,46.65,13.95";

const ROAD_CLASSES = [
  "motorway", "motorway_link",
  "trunk", "trunk_link",
  "primary", "primary_link",
  "secondary", "secondary_link",
  "tertiary", "tertiary_link",
  "unclassified",
  "residential", "living_street",
  "service",
];

const TRAIL_CLASSES = [
  "path",
  "footway",
  "track",
  "bridleway",
  "cycleway",
];

/** Douglas–Peucker tolerance in degrees ≈ 3 m at FVG latitude.
 *  Geometry simplification at build time keeps the runtime payload lean
 *  while leaving the visible polyline indistinguishable. */
const DP_EPS = 3e-5;

function buildQuery(classes) {
  return `
[out:json][timeout:180];
(
${classes.map((c) => `  way[highway=${c}](${BBOX});`).join("\n")}
);
out geom;
`;
}

async function tryFetch(endpoint, query) {
  console.log(`  → ${endpoint}`);
  const t0 = Date.now();
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": "landslide-app build-roads/1.0 (https://github.com/diiibe)",
      "accept": "application/json",
    },
    body: new URLSearchParams({ data: query }).toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text.slice(0, 200)}`);
  }
  const json = await res.json();
  console.log(`    ${json.elements?.length ?? 0} ways in ${(Date.now() - t0) / 1000}s`);
  return json;
}

async function fetchOverpass(classes, label) {
  console.log(`querying ${label} (${classes.length} classes) …`);
  let lastErr;
  for (const ep of ENDPOINTS) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        return await tryFetch(ep, buildQuery(classes));
      } catch (e) {
        lastErr = e;
        console.log(`    attempt ${attempt} failed: ${e.message?.slice(0, 100)}`);
        if (attempt < 3) await new Promise((r) => setTimeout(r, 5000 * attempt));
      }
    }
  }
  throw lastErr ?? new Error("all overpass endpoints failed");
}

function perpDistSq(p, a, b) {
  // Squared perpendicular distance from point p to line a→b.
  // Cheap planar approximation (good enough at our scale).
  const ax = a[0], ay = a[1];
  const bx = b[0], by = b[1];
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    const ex = p[0] - ax;
    const ey = p[1] - ay;
    return ex * ex + ey * ey;
  }
  const t = ((p[0] - ax) * dx + (p[1] - ay) * dy) / lenSq;
  const tc = Math.max(0, Math.min(1, t));
  const px = ax + tc * dx;
  const py = ay + tc * dy;
  const ex = p[0] - px;
  const ey = p[1] - py;
  return ex * ex + ey * ey;
}

function douglasPeucker(coords, epsSq) {
  if (coords.length < 3) return coords;
  const keep = new Uint8Array(coords.length);
  keep[0] = 1;
  keep[coords.length - 1] = 1;
  const stack = [[0, coords.length - 1]];
  while (stack.length > 0) {
    const [s, e] = stack.pop();
    let maxD = 0;
    let maxI = -1;
    for (let i = s + 1; i < e; i++) {
      const d = perpDistSq(coords[i], coords[s], coords[e]);
      if (d > maxD) { maxD = d; maxI = i; }
    }
    if (maxD > epsSq && maxI !== -1) {
      keep[maxI] = 1;
      stack.push([s, maxI], [maxI, e]);
    }
  }
  const out = [];
  for (let i = 0; i < coords.length; i++) {
    if (keep[i]) out.push(coords[i]);
  }
  return out;
}

function toGeoJSON(overpass) {
  const features = [];
  let totalIn = 0;
  let totalOut = 0;
  const epsSq = DP_EPS * DP_EPS;
  for (const el of overpass.elements ?? []) {
    if (el.type !== "way" || !el.geometry || el.geometry.length < 2) continue;
    // 5 decimals ≈ 1 m at FVG latitude — same effective resolution as the
    // cell grid (220 m), 6× smaller on disk than 6-decimal precision.
    const raw = el.geometry.map((n) => [
      Math.round(n.lon * 1e5) / 1e5,
      Math.round(n.lat * 1e5) / 1e5,
    ]);
    totalIn += raw.length;
    const coords = douglasPeucker(raw, epsSq);
    totalOut += coords.length;
    features.push({
      type: "Feature",
      id: el.id,
      properties: {}, // `risk` is added at runtime
      geometry: { type: "LineString", coordinates: coords },
    });
  }
  console.log(`  vertices: ${totalIn} → ${totalOut} (${((1 - totalOut / totalIn) * 100).toFixed(1)}% trimmed)`);
  return { type: "FeatureCollection", features };
}

async function build(label, classes, outFile) {
  const overpass = await fetchOverpass(classes, label);
  const fc = toGeoJSON(overpass);
  const text = JSON.stringify(fc);
  await writeFile(outFile, text);
  const sizeMb = (text.length / (1024 * 1024)).toFixed(2);
  console.log(`  ${fc.features.length} features (${sizeMb} MB) → ${outFile}\n`);
}

await build("roads", ROAD_CLASSES, `${OUT_DIR}/roads_fvg.geojson`);
await build("trails", TRAIL_CLASSES, `${OUT_DIR}/trails_fvg.geojson`);
