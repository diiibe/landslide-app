/**
 * File-upload pipeline: parse GPX / GeoJSON / KML payloads into a
 * normalised `{ kind, name, data, bounds }` shape the store consumes.
 *
 * The parsers run in the browser via DOMParser + JSON.parse — no
 * external dependency for the formats we ship today. Anything truly
 * exotic (Shapefile, GeoPackage) is out of scope until users ask.
 */

import type { UserLayer, UserLayerKind } from "@/app/types";

type ParsedUpload = Omit<UserLayer, "id" | "color" | "opacity" | "visible" | "createdAt">;

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB — generous for hiking GPX bundles
const ACCEPTED_EXT = [".gpx", ".geojson", ".json", ".kml"] as const;

export async function parseUserFile(file: File): Promise<ParsedUpload> {
  if (file.size > MAX_BYTES) {
    throw new Error(
      `File too large: ${(file.size / 1024 / 1024).toFixed(1)} MB (max 25 MB).`,
    );
  }
  const text = await file.text();
  const lower = file.name.toLowerCase();
  const stem = file.name.replace(/\.[^.]+$/, "");

  if (lower.endsWith(".gpx")) {
    return finalise(parseGpx(text), stem, "gpx");
  }
  if (lower.endsWith(".kml")) {
    return finalise(parseKml(text), stem, "geojson");
  }
  // Default to GeoJSON
  return finalise(parseGeoJson(text), stem, "geojson");
}

function finalise(
  fc: GeoJSON.FeatureCollection,
  name: string,
  kind: UserLayerKind,
): ParsedUpload {
  if (fc.features.length === 0) {
    throw new Error("File parsed but contains no features.");
  }
  return { name, kind, data: fc, bounds: featureCollectionBounds(fc) };
}

/* ───────────────────── GeoJSON ───────────────────── */

function parseGeoJson(text: string): GeoJSON.FeatureCollection {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON.");
  }
  if (!raw || typeof raw !== "object") {
    throw new Error("Not a GeoJSON object.");
  }
  const obj = raw as { type?: unknown; features?: unknown; geometry?: unknown };
  if (obj.type === "FeatureCollection" && Array.isArray(obj.features)) {
    return raw as GeoJSON.FeatureCollection;
  }
  if (obj.type === "Feature" && obj.geometry) {
    return { type: "FeatureCollection", features: [raw as GeoJSON.Feature] };
  }
  if (
    typeof obj.type === "string" &&
    /^(Point|LineString|Polygon|MultiPoint|MultiLineString|MultiPolygon)$/.test(
      obj.type,
    )
  ) {
    // bare geometry — wrap it
    return {
      type: "FeatureCollection",
      features: [
        { type: "Feature", properties: {}, geometry: raw as GeoJSON.Geometry },
      ],
    };
  }
  throw new Error("GeoJSON must be a FeatureCollection, Feature, or geometry.");
}

/* ───────────────────── GPX ───────────────────── */

/** Minimal GPX → GeoJSON converter. Handles trks (LineString per trkseg),
 *  rtes (LineString), and wpts (Points). Properties carry name, desc,
 *  cmt, sym if present. No deps; ~80 LOC. */
function parseGpx(text: string): GeoJSON.FeatureCollection {
  const doc = parseXml(text);
  const features: GeoJSON.Feature[] = [];

  // Tracks: each <trk> has 1+ <trkseg>; each segment is a LineString.
  for (const trk of Array.from(doc.getElementsByTagName("trk"))) {
    const name = textOf(trk, "name");
    for (const seg of Array.from(trk.getElementsByTagName("trkseg"))) {
      const coords = pointCoords(seg, "trkpt");
      if (coords.length < 2) continue;
      features.push({
        type: "Feature",
        properties: { name: name ?? "Track", _gpx: "trk" },
        geometry: { type: "LineString", coordinates: coords },
      });
    }
  }

  // Routes
  for (const rte of Array.from(doc.getElementsByTagName("rte"))) {
    const coords = pointCoords(rte, "rtept");
    if (coords.length < 2) continue;
    features.push({
      type: "Feature",
      properties: { name: textOf(rte, "name") ?? "Route", _gpx: "rte" },
      geometry: { type: "LineString", coordinates: coords },
    });
  }

  // Waypoints
  for (const wpt of Array.from(doc.getElementsByTagName("wpt"))) {
    const c = pointFromElement(wpt);
    if (!c) continue;
    features.push({
      type: "Feature",
      properties: {
        name: textOf(wpt, "name") ?? "Waypoint",
        sym: textOf(wpt, "sym") ?? undefined,
        desc: textOf(wpt, "desc") ?? undefined,
        _gpx: "wpt",
      },
      geometry: { type: "Point", coordinates: c },
    });
  }

  if (features.length === 0) {
    throw new Error("GPX contains no tracks, routes, or waypoints.");
  }
  return { type: "FeatureCollection", features };
}

function pointCoords(parent: Element, tag: string): number[][] {
  const pts = Array.from(parent.getElementsByTagName(tag));
  const out: number[][] = [];
  for (const p of pts) {
    const c = pointFromElement(p);
    if (c) out.push(c);
  }
  return out;
}

function pointFromElement(el: Element): number[] | null {
  const lat = parseFloat(el.getAttribute("lat") ?? "");
  const lon = parseFloat(el.getAttribute("lon") ?? "");
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const ele = parseFloat(textOf(el, "ele") ?? "");
  return Number.isFinite(ele) ? [lon, lat, ele] : [lon, lat];
}

function textOf(parent: Element, tag: string): string | null {
  const el = parent.getElementsByTagName(tag)[0];
  return el?.textContent?.trim() || null;
}

/* ───────────────────── KML (very light) ───────────────────── */

/** Tiny KML → GeoJSON: walks Placemarks pulling Point / LineString /
 *  Polygon. For anything beyond Placemarks (NetworkLinks, custom
 *  schemas) we leave it to a future bigger dep. */
function parseKml(text: string): GeoJSON.FeatureCollection {
  const doc = parseXml(text);
  const features: GeoJSON.Feature[] = [];
  for (const pm of Array.from(doc.getElementsByTagName("Placemark"))) {
    const name = textOf(pm, "name") ?? "Placemark";
    const description = textOf(pm, "description");
    const props: Record<string, unknown> = { name };
    if (description) props.description = description;

    const point = pm.getElementsByTagName("Point")[0];
    const line = pm.getElementsByTagName("LineString")[0];
    const poly = pm.getElementsByTagName("Polygon")[0];

    if (point) {
      const c = kmlCoords(textOf(point, "coordinates"));
      if (c[0]) {
        features.push({
          type: "Feature",
          properties: props,
          geometry: { type: "Point", coordinates: c[0] },
        });
      }
    } else if (line) {
      const c = kmlCoords(textOf(line, "coordinates"));
      if (c.length >= 2) {
        features.push({
          type: "Feature",
          properties: props,
          geometry: { type: "LineString", coordinates: c },
        });
      }
    } else if (poly) {
      const outer = poly.getElementsByTagName("outerBoundaryIs")[0];
      const ring = outer?.getElementsByTagName("LinearRing")[0];
      const c = kmlCoords(textOf(ring ?? poly, "coordinates"));
      if (c.length >= 4) {
        features.push({
          type: "Feature",
          properties: props,
          geometry: { type: "Polygon", coordinates: [c] },
        });
      }
    }
  }
  if (features.length === 0) {
    throw new Error("KML has no Point / LineString / Polygon Placemarks.");
  }
  return { type: "FeatureCollection", features };
}

function kmlCoords(raw: string | null): number[][] {
  if (!raw) return [];
  return raw
    .trim()
    .split(/\s+/)
    .map((triplet) => {
      const parts = triplet.split(",").map((p) => parseFloat(p));
      return parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])
        ? (parts.length >= 3 && Number.isFinite(parts[2])
            ? [parts[0]!, parts[1]!, parts[2]!]
            : [parts[0]!, parts[1]!])
        : null;
    })
    .filter((c): c is number[] => c !== null);
}

/* ───────────────────── shared helpers ───────────────────── */

function parseXml(text: string): Document {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  const err = doc.getElementsByTagName("parsererror")[0];
  if (err) throw new Error("XML parse error.");
  return doc;
}

export function featureCollectionBounds(
  fc: GeoJSON.FeatureCollection,
): [[number, number], [number, number]] | null {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  const visit = (c: number[]) => {
    const lng = c[0];
    const lat = c[1];
    if (typeof lng !== "number" || typeof lat !== "number") return;
    if (lng < west) west = lng;
    if (lng > east) east = lng;
    if (lat < south) south = lat;
    if (lat > north) north = lat;
  };
  const walkGeom = (g: GeoJSON.Geometry | null) => {
    if (!g) return;
    switch (g.type) {
      case "Point":
        visit(g.coordinates);
        break;
      case "MultiPoint":
      case "LineString":
        for (const c of g.coordinates) visit(c);
        break;
      case "MultiLineString":
      case "Polygon":
        for (const ring of g.coordinates) for (const c of ring) visit(c);
        break;
      case "MultiPolygon":
        for (const poly of g.coordinates)
          for (const ring of poly) for (const c of ring) visit(c);
        break;
      case "GeometryCollection":
        for (const inner of g.geometries) walkGeom(inner);
        break;
    }
  };
  for (const f of fc.features) walkGeom(f.geometry);
  if (!isFinite(west)) return null;
  return [[west, south], [east, north]];
}

export const UPLOAD_ACCEPT = ACCEPTED_EXT.join(",");
