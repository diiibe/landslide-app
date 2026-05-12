/**
 * Risk-tinted rendering for user-uploaded line layers (GPX tracks,
 * GeoJSON polylines). The trails network bakes a per-feature max risk
 * and tints the line via the trails ramp — but a typical GPX track is
 * ONE long LineString feature. Baking that as a single feature would
 * paint the whole track in one colour: the max risk along its path.
 *
 * To make it read as a heatmap along the route, we pre-split each
 * LineString into short overlapping segments (default ~20 vertices)
 * before baking, so each segment carries its own local-max risk and
 * the rendered colour shifts continuously down the track.
 */

import type { ModelId } from "@/app/types";
import { useAppStore } from "@/app/store";
import { bakeRiskIntoFeatures, loadCellGrid } from "./cellGrid";

const SEGMENT_VERTICES = 20;

function splitLineStringByLength(
  coords: GeoJSON.Position[],
  maxVertices: number,
): GeoJSON.Position[][] {
  const out: GeoJSON.Position[][] = [];
  if (coords.length < 2) return out;
  const step = Math.max(2, maxVertices - 1); // overlap last vertex with next first
  for (let i = 0; i < coords.length - 1; i += step) {
    const slice = coords.slice(i, i + maxVertices);
    if (slice.length >= 2) out.push(slice);
  }
  return out;
}

function explodeFeature(feat: GeoJSON.Feature): GeoJSON.Feature[] {
  const g = feat.geometry;
  if (!g) return [feat];
  const props = feat.properties ?? {};
  if (g.type === "LineString") {
    return splitLineStringByLength(g.coordinates, SEGMENT_VERTICES).map(
      (coords) => ({
        type: "Feature",
        properties: { ...props },
        geometry: { type: "LineString", coordinates: coords },
      }),
    );
  }
  if (g.type === "MultiLineString") {
    const out: GeoJSON.Feature[] = [];
    for (const seg of g.coordinates) {
      for (const slice of splitLineStringByLength(seg, SEGMENT_VERTICES)) {
        out.push({
          type: "Feature",
          properties: { ...props },
          geometry: { type: "LineString", coordinates: slice },
        });
      }
    }
    return out;
  }
  // Non-line geometries (Points etc.) pass through unchanged.
  return [feat];
}

/** Build a risk-baked, per-segment FeatureCollection for a user layer.
 *  Uses the active model's cell grid and the *trails* network's risk
 *  shaping params (gamma + radius) so the tint matches the OSM trails
 *  layer if the user has it visible alongside. */
export async function bakeUserLayerRisk(
  fc: GeoJSON.FeatureCollection,
  model: ModelId,
): Promise<GeoJSON.FeatureCollection> {
  const grid = await loadCellGrid(model);
  const params = useAppStore.getState().riskParams.trails[model];
  const split: GeoJSON.Feature[] = [];
  for (const f of fc.features) {
    for (const s of explodeFeature(f)) split.push(s);
  }
  const splitFc: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: split,
  };
  return bakeRiskIntoFeatures(splitFc, grid, {
    gamma: params.gamma,
    radius: params.radius,
  });
}
