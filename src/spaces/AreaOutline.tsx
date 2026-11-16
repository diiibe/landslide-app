/** A recognisable thumbnail of the actual perimeter, not a generic polygon icon. */
export function AreaOutline({ geometry, color = "currentColor" }: { geometry: GeoJSON.Polygon; color?: string | undefined }) {
  const points = geometry.coordinates.flat(), xs = points.map(p => p[0]!), ys = points.map(p => p[1]!);
  const x = Math.min(...xs), y = Math.min(...ys), cos = Math.cos((Math.min(...ys) + Math.max(...ys)) / 2 * Math.PI / 180);
  const w = Math.max(...xs) - x, h = Math.max(...ys) - y, scale = 48 / Math.max(w * cos, h, 1e-10);
  const dx = (64 - w * cos * scale) / 2, dy = (64 - h * scale) / 2;
  const d = geometry.coordinates.map(ring => ring.map((p, i) => `${i ? "L" : "M"}${dx + (p[0]! - x) * cos * scale},${64 - dy - (p[1]! - y) * scale}`).join(" ") + "Z").join(" ");
  return <svg viewBox="0 0 64 64" aria-hidden="true" style={{ color }}><path d={d} fill="currentColor" fillOpacity=".15" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" fillRule="evenodd"/></svg>;
}
