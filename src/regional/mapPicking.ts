import type { Map as MLMap, MapGeoJSONFeature } from "maplibre-gl";
/** A feature can be drawn by a halo, a point and a label (or two vector tiles). */
export function dataFeatureKey(f: MapGeoJSONFeature): string {
  const p = f.properties ?? {};
  return JSON.stringify([
    f.source ?? f.layer.id.replace(/-(halo|point|labels|direction|counts)$/, ""),
    f.sourceLayer,
    p.variable,
    p.__featureId ?? f.id ?? p.stationId ?? p.cluster_id ?? null,
    f.geometry,
    // Dimensions distinguish reused IDs; observed values are deliberately not
    // part of identity, so keyboard focus survives a telemetry refresh.
    p.__depth, p.sensorId,
    p.__featureId === undefined && f.id === undefined && p.stationId === undefined && p.cluster_id === undefined
      ? Object.entries(p).sort(([a], [b]) => a.localeCompare(b)) : null,
  ]);
}
export function pickDataFeatures(
  map: MLMap,
  point: { x: number; y: number },
  radius: number,
): MapGeoJSONFeature[] {
  const layers = (map.getStyle()?.layers ?? []).filter(l =>
    l.type !== "heatmap" && !l.id.startsWith("regional-selection") &&
    (l.id.startsWith("regional-") || l.id.startsWith("twin-sensors") || ["trek-node","trek-node-ring","trek-node-label","trek-hit","nature-node","nature-node-ring","nature-hit","nature-label","nature-cluster","nature-cluster-label"].includes(l.id) ||
      ["twin-aia", "twin-buildings", "twin-buildings-3d"].includes(l.id)),
  ).map(l => l.id);
  if (!layers.length) return [];
  const distance = (f: MapGeoJSONFeature) => {
    if (f.geometry.type !== "Point") return Infinity;
    const p = map.project(f.geometry.coordinates.slice(0, 2) as [number, number]);
    return Math.hypot(point.x - p.x, point.y - p.y);
  };
  const exact = map.queryRenderedFeatures([point.x, point.y], { layers });
  const nearby = map.queryRenderedFeatures([
    [point.x - radius, point.y - radius], [point.x + radius, point.y + radius],
  ], { layers });
  const points = [...exact, ...nearby].filter(f => f.geometry.type === "Point" &&
    (exact.includes(f) || distance(f) <= radius));
  const first = points.sort((a, b) => distance(a) - distance(b))[0];
  if (!first || first.geometry.type !== "Point") return exact.slice(0, 1);
  // Group by geographic position, never by the touch target: nearby, distinct
  // stations must remain separate even at regional zoom. Tolerance ~1 cm.
  const [lon, lat] = first.geometry.coordinates;
  const coincident = points.filter(f => f.geometry.type === "Point" &&
    Math.abs(f.geometry.coordinates[0]! - lon!) < 1e-7 &&
    Math.abs(f.geometry.coordinates[1]! - lat!) < 1e-7);
  const unique = new Map<string, MapGeoJSONFeature>();
  for (const feature of coincident) {
    const key = dataFeatureKey(feature);
    if (!unique.has(key)) unique.set(key, feature);
  }
  return [...unique.values()];
}
export function pickDataFeature(
  map: MLMap,
  point: { x: number; y: number },
  radius: number,
): MapGeoJSONFeature | undefined {
  const layers = map
    .getStyle()
    .layers.filter(
      (l) =>
        l.type !== "heatmap" &&
        !l.id.startsWith("regional-selection") &&
        (l.id.startsWith("regional-") ||
          l.id.startsWith("twin-sensors") ||
          ["twin-aia", "twin-buildings", "twin-buildings-3d"].includes(l.id)),
    )
    .map((l) => l.id);
  if (!layers.length) return;
  const distance = (f: MapGeoJSONFeature) => {
    if (f.geometry.type !== "Point") return Infinity;
    const p = map.project(
      f.geometry.coordinates.slice(0, 2) as [number, number],
    );
    return Math.hypot(point.x - p.x, point.y - p.y);
  };
  const exact = map.queryRenderedFeatures([point.x, point.y], { layers });
  const points = exact.filter((f) => f.geometry.type === "Point");
  if (points.length) return points.sort((a, b) => distance(a) - distance(b))[0];
  const nearby = map
    .queryRenderedFeatures(
      [
        [point.x - radius, point.y - radius],
        [point.x + radius, point.y + radius],
      ],
      { layers },
    )
    .filter((f) => f.geometry.type === "Point" && distance(f) <= radius);
  return nearby.sort((a, b) => distance(a) - distance(b))[0] ?? exact[0];
}
