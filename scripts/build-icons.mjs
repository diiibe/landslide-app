#!/usr/bin/env node
// Vendor a small set of POI icons from Phosphor Icons (fill weight) into
// `public/icons/`. Phosphor's `fill` variant is a filled silhouette, which
// is what MapLibre's SDF tinting needs — the alpha channel becomes the
// shape and `icon-color` paints it.
//
// Usage: node scripts/build-icons.mjs
//
// Phosphor is MIT-licensed; see https://phosphoricons.com.

import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(process.cwd());
const OUT_DIR = `${ROOT}/public/icons`;

// Map our internal POI category → Phosphor icon (fill weight).
// Pick names whose silhouette is unambiguous at 16-32 px on a map.
const ICONS = {
  hospital: "hospital-fill",
  school: "graduation-cap-fill",
  fire_station: "flame-fill",
  police: "shield-star-fill",
  alpine_hut: "house-fill",
  wilderness_hut: "tent-fill",
};

const BASE = "https://cdn.jsdelivr.net/npm/@phosphor-icons/core@2/assets/fill";

await mkdir(OUT_DIR, { recursive: true });

for (const [category, name] of Object.entries(ICONS)) {
  const url = `${BASE}/${name}.svg`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`✗ ${category} ← ${name}: HTTP ${res.status}`);
    continue;
  }
  const svg = await res.text();
  const out = `${OUT_DIR}/poi-${category}.svg`;
  await writeFile(out, svg);
  console.log(`✓ ${category} ← ${name} (${svg.length} bytes)`);
}
