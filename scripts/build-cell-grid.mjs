#!/usr/bin/env node
// Bake a coarse risk grid out of the centroids pmtiles for runtime road
// tinting. The result is a deterministic lookup that doesn't depend on
// what tiles MapLibre happens to have loaded at the current zoom.
//
//   pmtiles z14 centroids → bucket to 0.002° (~220 m) → max p per bucket
//   → flat JSON { step, data: [gx, gy, p, gx, gy, p, ...] }
//
// Usage: node scripts/build-cell-grid.mjs

import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const STEP = 0.002;
const MODELS = ["j2", "j3"];
const ROOT = resolve(process.cwd());

async function bake(model) {
  const src = `${ROOT}/public/tiles/centroids_${model}.pmtiles`;
  const dst = `${ROOT}/public/data/cell_grid_${model}.json`;
  console.log(`extracting ${model} from ${src} …`);

  const proc = spawn("tippecanoe-decode", ["-Z", "14", "-z", "14", src], {
    stdio: ["ignore", "pipe", "inherit"],
  });

  const grid = new Map();
  let leftover = "";
  // Match: ..."p": <num>... "coordinates": [<lng>, <lat>] ...
  const re = /"p"\s*:\s*([0-9.eE+-]+)[\s\S]*?"coordinates"\s*:\s*\[\s*([0-9.eE+-]+)\s*,\s*([0-9.eE+-]+)\s*\]/;

  await new Promise((res, rej) => {
    proc.stdout.setEncoding("utf8");
    proc.stdout.on("data", (chunk) => {
      const text = leftover + chunk;
      const lines = text.split("\n");
      leftover = lines.pop() ?? "";
      for (const line of lines) {
        const m = re.exec(line);
        if (!m) continue;
        const p = Number(m[1]);
        const lng = Number(m[2]);
        const lat = Number(m[3]);
        if (!Number.isFinite(p) || !Number.isFinite(lng) || !Number.isFinite(lat)) continue;
        const gx = Math.floor(lng / STEP);
        const gy = Math.floor(lat / STEP);
        const key = (gx << 16) | (gy & 0xffff);
        const prev = grid.get(key) ?? 0;
        if (p > prev) grid.set(key, p);
      }
    });
    proc.stdout.on("end", res);
    proc.on("error", rej);
  });

  // Flatten: [gx, gy, p (3 decimals)] × N. Pre-sort for better gzip.
  const entries = [...grid.entries()];
  entries.sort((a, b) => a[0] - b[0]);
  const data = [];
  for (const [k, p] of entries) {
    const gx = k >> 16;
    const gy = (k & 0xffff) << 16 >> 16; // sign-extend 16 bits
    data.push(gx, gy, Math.round(p * 1000) / 1000);
  }
  const json = { step: STEP, data };
  await writeFile(dst, JSON.stringify(json));
  console.log(`  ${entries.length} grid cells → ${dst}`);
}

for (const m of MODELS) {
  await bake(m);
}
