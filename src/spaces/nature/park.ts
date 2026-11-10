import type { TreeFeature } from "./store";
import { treeId } from "./store";
export function groupTrees(trees: TreeFeature[], field: string) {
  const map = new Map<string, number>();
  for (const t of trees) {
    const key =
      String(t.properties[field] ?? "Non indicato").trim() || "Non indicato";
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "it"));
}
function metres(a: number[], b: number[]) {
  const rad = Math.PI / 180,
    lat = ((a[1]! + b[1]!) / 2) * rad;
  return Math.hypot(
    (a[0]! - b[0]!) * 111320 * Math.cos(lat),
    (a[1]! - b[1]!) * 110574,
  );
}
/** Greedy proximity order; geometric distance only, not a walkable itinerary. */
export function orderPlan(ids: string[], trees: TreeFeature[]) {
  const byId = new Map(trees.map((t) => [treeId(t), t]));
  const remaining = ids.filter((id) => byId.has(id)),
    ordered: string[] = [];
  let distance = 0;
  if (!remaining.length) return { ids: ordered, distance };
  ordered.push(remaining.shift()!);
  while (remaining.length) {
    const from = byId.get(ordered[ordered.length - 1]!)!;
    remaining.sort(
      (a, b) =>
        metres(from.geometry.coordinates, byId.get(a)!.geometry.coordinates) -
        metres(from.geometry.coordinates, byId.get(b)!.geometry.coordinates),
    );
    const next = remaining.shift()!;
    distance += metres(
      from.geometry.coordinates,
      byId.get(next)!.geometry.coordinates,
    );
    ordered.push(next);
  }
  return { ids: ordered, distance };
}
