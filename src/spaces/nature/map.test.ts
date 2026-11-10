import { it, expect } from "vitest";
import type { Map as MLMap } from "maplibre-gl";
import { mountNatureMap } from "./map";
import { useExperienceStore } from "../store";
import { useAppStore } from "@/app/store";
it("ignores a cluster expansion resolved by the previous style source", async () => {
  const sources = new Map<string, object>(),
    layers = new Set<string>(),
    handlers = new Map<string, ((...args: unknown[]) => unknown)[]>(),
    moves: unknown[] = [];
  let resolve: (value: number) => void = () => {};
  const pending = new Promise<number>((done) => {
    resolve = done;
  });
  const map = {
    isStyleLoaded: () => true,
    getSource: (id: string) => sources.get(id),
    getLayer: (id: string) => layers.has(id),
    addSource: (id: string) =>
      sources.set(id, {
        setData: () => {},
        getClusterExpansionZoom: () => pending,
      }),
    removeSource: (id: string) => sources.delete(id),
    addLayer: (spec: { id: string }) => layers.add(spec.id),
    removeLayer: (id: string) => layers.delete(id),
    setFilter: () => {},
    setPaintProperty: () => {},
    on: (event: string, cb: (...args: unknown[]) => unknown) =>
      handlers.set(event, [...(handlers.get(event) ?? []), cb]),
    off: () => {},
    getCanvas: () => ({ style: { cursor: "" } }),
    queryRenderedFeatures: () => [
      {
        type: "Feature",
        layer: { id: "nature-cluster" },
        geometry: { type: "Point", coordinates: [13.01, 45.95] },
        properties: { cluster_id: 1 },
      },
    ],
    easeTo: (value: unknown) => moves.push(value),
  };
  useAppStore.setState({ drawingMode: false });
  useExperienceStore.setState({ activeId: "park", selectedId: null });
  const unmount = mountNatureMap(map as unknown as MLMap);
  const click = handlers.get("click")![0]!;
  const navigation = click({ point: { x: 0, y: 0 } });
  handlers.get("styledataloading")![0]!();
  sources.clear();
  layers.clear();
  handlers.get("style.load")![0]!();
  resolve(17);
  await navigation;
  expect(moves).toHaveLength(0);
  expect(layers.size).toBe(8);
  unmount();
  expect(sources.size).toBe(0);
  useExperienceStore.setState({ activeId: null });
});
