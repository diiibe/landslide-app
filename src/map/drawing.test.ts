import { it, expect, vi } from "vitest";
import type { Map as MLMap } from "maplibre-gl";
import { computeStatsForPolygon } from "./drawing";
import { useAppStore } from "@/app/store";
it("saves the geographical area without reading hidden historical susceptibility or recording zeros as current observations", () => {
  useAppStore.getState().reset();
  const queryRenderedFeatures = vi.fn();
  const map = {
    getLayer: () => true,
    queryRenderedFeatures,
  } as unknown as MLMap;
  const stats = computeStatsForPolygon(map, {
    type: "Polygon",
    coordinates: [
      [
        [13, 46],
        [13.01, 46],
        [13.01, 46.01],
        [13, 46],
      ],
    ],
  });
  expect(stats.areaKm2).toBeGreaterThan(0);
  expect(stats.meanP).toBeNull();
  expect(stats.cellsVisible).toBeNull();
  expect(stats.model).toBeNull();
  expect(stats.unavailableReason).toContain("non calcolate");
  expect(queryRenderedFeatures).not.toHaveBeenCalled();
});
