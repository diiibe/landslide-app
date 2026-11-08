import { expect, it, vi } from "vitest";
import type { Map as MLMap, MapGeoJSONFeature } from "maplibre-gl";
import { pickTwinFeature } from "./mapInteractions";
const sensor = (id: number, x: number, y: number) => ({ type: "Feature", id, layer: { id: "twin-sensors" }, geometry: { type: "Point", coordinates: [x, y] }, properties: { stationId: id } }) as unknown as MapGeoJSONFeature;
it("expands touch point targets while choosing the nearest measured point", () => {
  const close = sensor(1, 20, 0), far = sensor(2, 30, 0);
  const query = vi.fn().mockReturnValueOnce([]).mockReturnValueOnce([far, close]);
  const map = { getLayer: () => true, queryRenderedFeatures: query, project: ([x,y]: number[]) => ({ x, y }) } as unknown as MLMap;
  expect(pickTwinFeature(map, { x: 0, y: 0 }, 22)?.id).toBe(1);
  expect(query.mock.calls[1]?.[0]).toEqual([[-22,-22],[22,22]]);
});
it("does not replace an exact building hit with a point outside the touch target", () => {
  const building = { type: "Feature", id: "building", layer: { id: "twin-buildings" }, geometry: { type: "Polygon", coordinates: [] }, properties: {} } as unknown as MapGeoJSONFeature;
  const query = vi.fn().mockReturnValueOnce([building]).mockReturnValueOnce([sensor(1, 30, 0)]);
  const map = { getLayer: () => true, queryRenderedFeatures: query, project: ([x,y]: number[]) => ({ x, y }) } as unknown as MLMap;
  expect(pickTwinFeature(map, { x: 0, y: 0 }, 22)?.id).toBe("building");
});
