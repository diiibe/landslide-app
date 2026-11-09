import { render, screen, fireEvent, act } from "@testing-library/react";
import { it, expect, afterEach, vi } from "vitest";
import { RegionalPanel } from "./Panel";
import { useRegionalStore } from "./store";
import { useTwinStore } from "@/digital-twin/store";
import type { LayerDefinition } from "./types";
vi.mock("@/map-overlays/LayersPanel", () => ({ LayersPanel: () => null }));
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    disconnect() {}
  },
);
afterEach(() => {
  useRegionalStore.setState({
    catalog: null,
    enabled: {},
    entries: {},
    selection: null,
    detailId: null,
  });
});
it("lets the user inspect separate observations at identical coordinates and labels details from an old data version", () => {
  const layer: LayerDefinition = {
    id: "sample",
    title: "Campioni",
    folder: "acqua",
    kind: "geojson",
    status: "ready",
    sourceId: "sample",
    sourceUrl: "https://example.com",
    provider: "Regione",
    license: "IODL2",
    licenseUrl: "https://example.com",
    description: "Campioni osservati",
    note: "",
    cadence: "",
    color: "#222222",
  };
  const features = ["A", "B"].map((id, i): GeoJSON.Feature => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: [13.7, 45.7] },
    properties: {
      __featureId: id,
      __name: id,
      __value: i,
      __displayValue: String(i),
    },
  }));
  useTwinStore.setState({ selection: null });
  useRegionalStore.setState({
    catalog: { generatedAt: "2026-01-01", layers: [layer] },
    enabled: { sample: true },
    tab: "layers",
    query: "",
    activeOnly: false,
    entries: {
      sample: {
        data: { type: "FeatureCollection", features },
        loading: false,
        error: null,
        snapshot: true,
      },
    },
    selection: { layerId: "sample", feature: features[0]! },
  });
  render(<RegionalPanel />);
  const choose = screen.getByLabelText("Elementi nello stesso punto");
  fireEvent.click(choose);
  fireEvent.click(screen.getByRole("option", { name: /^2\. B/ }));
  expect(
    useRegionalStore.getState().selection?.feature.properties?.__name,
  ).toBe("B");
  expect(screen.getByRole("heading", { name: "B" })).toBeInTheDocument();
  act(() =>
    useRegionalStore.setState({
      entries: {
        sample: {
          data: { type: "FeatureCollection", features: [] },
          loading: false,
          error: null,
          snapshot: false,
        },
      },
    }),
  );
  expect(
    screen.getByText(/appartiene alla versione precedente/),
  ).toBeInTheDocument();
});
