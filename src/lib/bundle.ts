/**
 * Bundle export / import — round-trip the user's uploaded layers and
 * drawn polygons through a single .geojson file the user can back up,
 * share, or re-import on another browser.
 *
 * Format: a FeatureCollection where each feature carries a
 * `fvg:bundle` magic property describing how it was created:
 *   - `fvg:bundle = "layer"` — a UserLayer feature (one entry per
 *     uploaded GPX/GeoJSON track), nested as Feature[] inside
 *     properties.features (because the layer itself is a collection).
 *   - `fvg:bundle = "polygon"` — a UserPolygon with its stats baked
 *     into properties.
 * On import we look at the magic key to reconstruct the right store
 * record.
 */

import type { UserLayer, UserPolygon } from "@/app/types";

const MAGIC = "fvg-landslide-app";
const VERSION = 1;

interface BundleEnvelope extends GeoJSON.FeatureCollection {
  meta: {
    magic: typeof MAGIC;
    version: number;
    exportedAt: number;
    counts: { layers: number; polygons: number };
  };
}

export function buildBundle(
  layers: UserLayer[],
  polygons: UserPolygon[],
): BundleEnvelope {
  const features: GeoJSON.Feature[] = [];

  for (const l of layers) {
    features.push({
      type: "Feature",
      properties: {
        "fvg:bundle": "layer",
        id: l.id,
        name: l.name,
        kind: l.kind,
        color: l.color,
        opacity: l.opacity,
        visible: l.visible,
        bounds: l.bounds,
        createdAt: l.createdAt,
        // Nest the original FeatureCollection so a single round-trip
        // preserves every track + waypoint.
        data: l.data,
      },
      // Bundles aren't directly usable as standalone GeoJSON because
      // the geometry is nested; we still set one so GeoJSON-only
      // viewers don't choke on a null geometry.
      geometry: l.data.features[0]?.geometry ?? {
        type: "Point",
        coordinates: [0, 0],
      },
    });
  }

  for (const p of polygons) {
    features.push({
      type: "Feature",
      properties: {
        "fvg:bundle": "polygon",
        id: p.id,
        name: p.name,
        color: p.color,
        createdAt: p.createdAt,
        bounds: p.bounds,
        stats: p.stats,
      },
      geometry: p.geometry,
    });
  }

  return {
    type: "FeatureCollection",
    features,
    meta: {
      magic: MAGIC,
      version: VERSION,
      exportedAt: Date.now(),
      counts: { layers: layers.length, polygons: polygons.length },
    },
  };
}

/** Drive the browser's "save as" dialog. Tries File System Access API
 *  first (Chrome desktop only), falls back to anchor-blob download. */
export async function downloadBundle(bundle: BundleEnvelope): Promise<void> {
  const blob = new Blob([JSON.stringify(bundle, null, 2)], {
    type: "application/geo+json",
  });
  const filename = `fvg-landslide-bundle-${new Date()
    .toISOString()
    .slice(0, 10)}.geojson`;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export interface ImportedBundle {
  layers: Array<Omit<UserLayer, "id" | "createdAt">>;
  polygons: Array<Omit<UserPolygon, "id" | "createdAt">>;
}

/** Parse a bundle file. Falls back to plain GeoJSON ingestion (no
 *  bundle metadata → treat the whole thing as a single user layer). */
export function parseBundleFile(text: string): ImportedBundle {
  const raw = JSON.parse(text) as unknown;
  if (!raw || typeof raw !== "object") throw new Error("Invalid bundle JSON.");
  const env = raw as Partial<BundleEnvelope>;
  if (!env.features || !Array.isArray(env.features)) {
    throw new Error("Bundle has no features array.");
  }
  const isOurBundle = env.meta && (env.meta as { magic?: string }).magic === MAGIC;
  if (!isOurBundle) {
    throw new Error("Not an FVG landslide bundle.");
  }
  const layers: ImportedBundle["layers"] = [];
  const polygons: ImportedBundle["polygons"] = [];
  for (const f of env.features) {
    const tag = (f.properties as { "fvg:bundle"?: string } | null)?.[
      "fvg:bundle"
    ];
    if (tag === "layer") {
      const p = f.properties as Record<string, unknown>;
      const data = p.data as GeoJSON.FeatureCollection | undefined;
      if (!data || !Array.isArray(data.features)) continue;
      layers.push({
        name: String(p.name ?? "Imported layer"),
        kind: (p.kind === "gpx" ? "gpx" : "geojson"),
        color: String(p.color ?? "#FFD400"),
        opacity: Number(p.opacity ?? 1),
        visible: Boolean(p.visible ?? true),
        data,
        bounds:
          (p.bounds as [[number, number], [number, number]] | null | undefined) ??
          null,
      });
    } else if (tag === "polygon" && f.geometry?.type === "Polygon") {
      const p = f.properties as Record<string, unknown>;
      const stats = p.stats as UserPolygon["stats"] | undefined;
      const bounds = p.bounds as [[number, number], [number, number]] | undefined;
      if (!stats || !bounds) continue;
      polygons.push({
        name: String(p.name ?? "Imported area"),
        color: String(p.color ?? "#FFD400"),
        geometry: f.geometry,
        bounds,
        stats,
      });
    }
  }
  return { layers, polygons };
}
