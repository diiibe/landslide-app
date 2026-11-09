import type { Map as MLMap, MapGeoJSONFeature } from "maplibre-gl";
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
