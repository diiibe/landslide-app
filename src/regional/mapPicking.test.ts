import { expect, it, vi } from "vitest";
import type { Map as MLMap, MapGeoJSONFeature } from "maplibre-gl";
import { pickDataFeatures } from "./mapPicking";
const feature = (source: string, id: string, depth = 0, x = 13) => ({
  type: "Feature", id, source, layer: { id: source + "-point" },
  geometry: { type: "Point", coordinates: [x, 46] },
  properties: { __featureId: id, __depth: depth, __value: depth },
}) as unknown as MapGeoJSONFeature;
function mapWith(features: MapGeoJSONFeature[]) {
  return { getStyle: () => ({ layers: [{ id: "regional-a-point", type: "circle" }] }),
    queryRenderedFeatures: vi.fn(() => features),
    project: ([x, y]: number[]) => ({ x: x! * 10, y: y! * 10 }),
  } as unknown as MLMap;
}
it("shows all co-located layers and depths, with one item per data record rather than one per drawing layer", () => {
  const a = feature("regional-a", "1", 0), deeper = feature("regional-a", "1", 10), b = feature("regional-b", "1");
  const halo = { ...a, layer: { id: "regional-a-halo" } } as MapGeoJSONFeature;
  const label = { ...a, layer: { id: "regional-a-labels" } } as MapGeoJSONFeature;
  const nearby = feature("regional-a", "2", 0, 13.001);
  expect(pickDataFeatures(mapWith([a, halo, label, deeper, b, nearby]), { x: 130, y: 460 }, 22)).toEqual([a, deeper, b]);
});
it("keeps distinct records with no provider ID and does not group neighboring stations at small map scales", () => {
  const a = feature("regional-a", "1"), b = feature("regional-a", "2");
  a.id = undefined; b.id = undefined;
  a.properties = { __name: "A" }; b.properties = { __name: "B" };
  expect(pickDataFeatures(mapWith([a, b]), { x: 130, y: 460 }, 8)).toHaveLength(2);
  b.geometry = { type: "Point", coordinates: [13.0001, 46] };
  expect(pickDataFeatures(mapWith([a, b]), { x: 130, y: 460 }, 22)).toEqual([a]);
});
it("preserves polygon picking when there are no points at the target", () => {
  const polygon = { ...feature("regional-a", "a"), geometry: { type: "Polygon", coordinates: [] } } as unknown as MapGeoJSONFeature;
  expect(pickDataFeatures(mapWith([polygon]), { x: 130, y: 460 }, 8)).toEqual([polygon]);
});
it("keeps Nature records distinct when clustered GeoJSON exposes numeric zero IDs",()=>{
 const a={...feature("nature-nodes","tree-a"),id:0,layer:{id:"nature-node"}} as MapGeoJSONFeature,b={...feature("nature-nodes","tree-b"),id:0,layer:{id:"nature-node"}} as MapGeoJSONFeature;
 const halo={...a,layer:{id:"nature-hit"}} as MapGeoJSONFeature;
 const m=mapWith([a,halo,b]);(m.getStyle as unknown as (()=>unknown))=()=>({layers:[{id:"nature-node",type:"circle"},{id:"nature-hit",type:"circle"}]});
 expect(pickDataFeatures(m,{x:130,y:460},22)).toEqual([a,b]);
});
