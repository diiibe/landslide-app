/**
 * Export pipeline for user data. Four supported formats:
 *
 *   - **bundle**: the existing FVG landslide bundle (round-trips back
 *     into the same app via Import bundle). Carries layers + polygons
 *     with their stats baked in via the magic-key envelope.
 *   - **geojson**: a flat FeatureCollection with the selected layers'
 *     features + selected polygons. No magic metadata so any GeoJSON
 *     viewer (QGIS, geojson.io, …) can open it.
 *   - **gpx**: line features become `<trk><trkseg><trkpt>`s; point
 *     features become `<wpt>`s. Polygons get their outer ring exported
 *     as a single track. Stats and risk-tinting are not GPX concepts —
 *     they're dropped.
 *   - **png**: a screenshot of the current map canvas via toDataURL.
 *     Not user-data dependent; everything visible at click time goes in.
 */

import type { Map as MLMap } from "maplibre-gl";
import type { UserLayer, UserPolygon } from "@/app/types";
import { buildBundle } from "./bundle";

export type ExportFormat = "bundle" | "geojson" | "gpx" | "png";

export interface ExportSelection {
  /** Set of UserLayer ids to include. */
  layerIds: Set<string>;
  /** Set of UserPolygon ids to include. */
  polygonIds: Set<string>;
}

const TODAY = () => new Date().toISOString().slice(0, 10);

function pickLayers(layers: UserLayer[], sel: ExportSelection): UserLayer[] {
  return layers.filter((l) => sel.layerIds.has(l.id));
}
function pickPolygons(polygons: UserPolygon[], sel: ExportSelection): UserPolygon[] {
  return polygons.filter((p) => sel.polygonIds.has(p.id));
}

/* ───────────────────── bundle ───────────────────── */

export function exportBundle(
  layers: UserLayer[],
  polygons: UserPolygon[],
  sel: ExportSelection,
): { blob: Blob; filename: string } {
  const bundle = buildBundle(pickLayers(layers, sel), pickPolygons(polygons, sel));
  return {
    blob: new Blob([JSON.stringify(bundle, null, 2)], {
      type: "application/geo+json",
    }),
    filename: `fvg-landslide-bundle-${TODAY()}.geojson`,
  };
}

/* ───────────────────── flat GeoJSON ───────────────────── */

export function exportFlatGeoJson(
  layers: UserLayer[],
  polygons: UserPolygon[],
  sel: ExportSelection,
): { blob: Blob; filename: string } {
  const features: GeoJSON.Feature[] = [];
  for (const l of pickLayers(layers, sel)) {
    for (const f of l.data.features) {
      features.push({
        ...f,
        properties: {
          ...(f.properties ?? {}),
          "fvg:layer": l.name,
          "fvg:color": l.color,
        },
      });
    }
  }
  for (const p of pickPolygons(polygons, sel)) {
    features.push({
      type: "Feature",
      properties: {
        "fvg:area": p.name,
        "fvg:color": p.color,
        "fvg:areaKm2": p.stats.areaKm2,
        "fvg:cellsVisible": p.stats.cellsVisible,
        "fvg:cellsAboveThreshold": p.stats.cellsAboveThreshold,
        "fvg:meanP": p.stats.meanP,
        "fvg:medianP": p.stats.medianP,
        "fvg:iffiCount": p.stats.iffiCount,
        "fvg:threshold": p.stats.threshold,
        "fvg:model": p.stats.model,
      },
      geometry: p.geometry,
    });
  }
  return {
    blob: new Blob(
      [JSON.stringify({ type: "FeatureCollection", features }, null, 2)],
      { type: "application/geo+json" },
    ),
    filename: `fvg-export-${TODAY()}.geojson`,
  };
}

/* ───────────────────── GPX ───────────────────── */

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function gpxTrack(name: string, segments: number[][][]): string {
  if (segments.length === 0 || segments.every((s) => s.length < 2)) return "";
  const segs = segments
    .filter((s) => s.length >= 2)
    .map((seg) => {
      const pts = seg
        .map((c) => {
          const lon = c[0];
          const lat = c[1];
          if (typeof lon !== "number" || typeof lat !== "number") return "";
          return `      <trkpt lat="${lat}" lon="${lon}"/>`;
        })
        .filter(Boolean)
        .join("\n");
      return `    <trkseg>\n${pts}\n    </trkseg>`;
    })
    .join("\n");
  return `  <trk>\n    <name>${xmlEscape(name)}</name>\n${segs}\n  </trk>`;
}

function gpxWaypoint(name: string, c: number[]): string {
  const lon = c[0];
  const lat = c[1];
  if (typeof lon !== "number" || typeof lat !== "number") return "";
  return `  <wpt lat="${lat}" lon="${lon}"><name>${xmlEscape(name)}</name></wpt>`;
}

function ringToTrack(ring: number[][]): number[][] {
  // GPX has no native polygon — emit the outer ring as a closed track.
  return ring;
}

export function exportGpx(
  layers: UserLayer[],
  polygons: UserPolygon[],
  sel: ExportSelection,
): { blob: Blob; filename: string } {
  const parts: string[] = [];

  for (const l of pickLayers(layers, sel)) {
    let trkIdx = 0;
    let wptIdx = 0;
    for (const f of l.data.features) {
      const props = (f.properties ?? {}) as Record<string, unknown>;
      const name = typeof props.name === "string" ? props.name : `${l.name} ${++trkIdx}`;
      const g = f.geometry;
      if (!g) continue;
      if (g.type === "Point") {
        const wp = gpxWaypoint(name || `${l.name} ${++wptIdx}`, g.coordinates);
        if (wp) parts.push(wp);
      } else if (g.type === "MultiPoint") {
        for (const c of g.coordinates) {
          const wp = gpxWaypoint(`${l.name} ${++wptIdx}`, c);
          if (wp) parts.push(wp);
        }
      } else if (g.type === "LineString") {
        const trk = gpxTrack(name, [g.coordinates]);
        if (trk) parts.push(trk);
      } else if (g.type === "MultiLineString") {
        const trk = gpxTrack(name, g.coordinates);
        if (trk) parts.push(trk);
      } else if (g.type === "Polygon" && g.coordinates[0]) {
        const trk = gpxTrack(name, [ringToTrack(g.coordinates[0])]);
        if (trk) parts.push(trk);
      }
    }
  }

  for (const p of pickPolygons(polygons, sel)) {
    const ring = p.geometry.coordinates[0];
    if (!ring || ring.length < 4) continue;
    const trk = gpxTrack(p.name, [ringToTrack(ring)]);
    if (trk) parts.push(trk);
  }

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<gpx version="1.1" creator="FVG Landslide" xmlns="http://www.topografix.com/GPX/1/1">\n` +
    parts.join("\n") +
    `\n</gpx>\n`;

  return {
    blob: new Blob([xml], { type: "application/gpx+xml" }),
    filename: `fvg-export-${TODAY()}.gpx`,
  };
}

/* ───────────────────── PNG screenshot ───────────────────── */

export async function exportPng(m: MLMap): Promise<{ blob: Blob; filename: string }> {
  // MapLibre canvases use `preserveDrawingBuffer: false` in some setups,
  // which makes `toDataURL` return a blank image. Force a re-render
  // synchronously before the readback so the next paint is in the
  // buffer when we grab it.
  m.triggerRepaint();
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const canvas = m.getCanvas();
  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas.toBlob returned null"))), "image/png");
  });
  return { blob, filename: `fvg-map-${TODAY()}.png` };
}

/* ───────────────────── shared download helper ───────────────────── */

export function downloadBlob(blob: Blob, filename: string): void {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
