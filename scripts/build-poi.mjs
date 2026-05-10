#!/usr/bin/env node
// Bake critical POIs + alpine huts into a static GeoJSON, with per-model
// risk pre-computed via the cell grid.
//
// Categories (importance = circle radius in render):
//   hospital         (8)
//   fire_station     (6)
//   police           (6)
//   school           (5)   — also university / college
//   alpine_hut       (5)
//   wilderness_hut   (4)
//
// Output: public/data/poi_fvg.geojson

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(process.cwd());
const OUT = `${ROOT}/public/data/poi_fvg.geojson`;
const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];
const BBOX = "45.5,12.3,46.65,13.95";

const QUERY = `
[out:json][timeout:120];
(
  node[amenity=hospital](${BBOX});
  way[amenity=hospital](${BBOX});
  node[amenity=fire_station](${BBOX});
  way[amenity=fire_station](${BBOX});
  node[amenity=police](${BBOX});
  way[amenity=police](${BBOX});
  node[amenity=school](${BBOX});
  way[amenity=school](${BBOX});
  node[amenity=university](${BBOX});
  way[amenity=university](${BBOX});
  node[amenity=college](${BBOX});
  way[amenity=college](${BBOX});
  node[tourism=alpine_hut](${BBOX});
  way[tourism=alpine_hut](${BBOX});
  node[tourism=wilderness_hut](${BBOX});
  way[tourism=wilderness_hut](${BBOX});
);
out center tags;
`;

async function tryFetch(endpoint) {
  console.log(`  → ${endpoint}`);
  const t0 = Date.now();
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": "landslide-app build-poi/1.0 (https://github.com/diiibe)",
      "accept": "application/json",
    },
    body: new URLSearchParams({ data: QUERY }).toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text.slice(0, 200)}`);
  }
  const json = await res.json();
  console.log(`    ${json.elements?.length ?? 0} elements in ${(Date.now() - t0) / 1000}s`);
  return json;
}

async function fetchOverpass() {
  console.log(`querying overpass for POIs …`);
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

function classify(tags) {
  const a = tags?.amenity;
  const t = tags?.tourism;
  if (a === "hospital") return { category: "hospital", group: "critical", importance: 8 };
  if (a === "fire_station") return { category: "fire_station", group: "critical", importance: 6 };
  if (a === "police") return { category: "police", group: "critical", importance: 6 };
  if (a === "school" || a === "university" || a === "college") {
    return { category: "school", group: "critical", importance: 5 };
  }
  if (t === "alpine_hut") return { category: "alpine_hut", group: "huts", importance: 5 };
  if (t === "wilderness_hut") return { category: "wilderness_hut", group: "huts", importance: 4 };
  return null;
}

async function loadGrid(model) {
  const j = JSON.parse(await readFile(`${ROOT}/public/data/cell_grid_${model}.json`, "utf8"));
  const cells = new Map();
  for (let i = 0; i < j.data.length; i += 3) {
    const gx = j.data[i];
    const gy = j.data[i + 1];
    const p = j.data[i + 2];
    cells.set(((gx & 0xffff) << 16) | (gy & 0xffff), p);
  }
  return { step: j.step, cells };
}

function lookupRisk(grid, lng, lat) {
  const gx = Math.floor(lng / grid.step);
  const gy = Math.floor(lat / grid.step);
  return grid.cells.get(((gx & 0xffff) << 16) | (gy & 0xffff)) ?? 0;
}

async function main() {
  const overpass = await fetchOverpass();
  const [gridJ2, gridJ3] = await Promise.all([loadGrid("j2"), loadGrid("j3")]);

  const features = [];
  let skipped = 0;
  for (const el of overpass.elements ?? []) {
    const lng = el.type === "node" ? el.lon : el.center?.lon;
    const lat = el.type === "node" ? el.lat : el.center?.lat;
    if (typeof lng !== "number" || typeof lat !== "number") {
      skipped++;
      continue;
    }
    const cls = classify(el.tags);
    if (!cls) continue;
    features.push({
      type: "Feature",
      id: `${el.type}/${el.id}`,
      properties: {
        name: el.tags?.name ?? "",
        category: cls.category,
        group: cls.group,
        importance: cls.importance,
        risk_j2: Math.round(lookupRisk(gridJ2, lng, lat) * 1000) / 1000,
        risk_j3: Math.round(lookupRisk(gridJ3, lng, lat) * 1000) / 1000,
      },
      geometry: {
        type: "Point",
        coordinates: [Math.round(lng * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5],
      },
    });
  }

  // Counts per category for sanity.
  const tally = features.reduce((m, f) => {
    const k = f.properties.category;
    m.set(k, (m.get(k) ?? 0) + 1);
    return m;
  }, new Map());
  for (const [k, n] of tally) console.log(`  ${k}: ${n}`);
  if (skipped) console.log(`  (skipped ${skipped} elements without coords)`);

  const text = JSON.stringify({ type: "FeatureCollection", features });
  await writeFile(OUT, text);
  const sizeKb = (text.length / 1024).toFixed(1);
  console.log(`wrote ${features.length} POIs (${sizeKb} KB) → ${OUT}`);
}

await main();
