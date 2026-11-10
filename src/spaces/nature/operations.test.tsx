// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { FireComparison } from "./FireComparison";
import { compareAir, AIR_OBSERVATIONS } from "./fire";
import { CAMERAS, cameraSector, cameraOnline } from "./wildlife";
import { CameraInstallation } from "./CameraNetwork";
import { useNatureStore, type TreeFeature } from "./store";
import { useExperienceStore } from "../store";
import { FirePanel } from "./FirePanel";
import { WildlifePanel } from "./WildlifePanel";
import { useAppStore } from "@/app/store";
import { TreeDetails, ParkPanel } from "./ParkPanel";
import { csvCell, parkWorklist } from "./worklist";
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    disconnect() {}
    unobserve() {}
  },
);
afterEach(() => {
  cleanup();
  useAppStore.setState({ cameraRequest: null });
  useNatureStore.setState({
    plan: [],
    trees: [],
    cameraChecks: {},
    treeQuery: "",
    family: "all",
  });
  useExperienceStore.setState({ activeId: null, selectedId: null });
});
it("compares complete observed ranges, including inversion and the same sample", () => {
  const a = AIR_OBSERVATIONS.find(
    (o) => o.site === "pissebus" && o.date === "2026-08-16",
  )!;
  const b = AIR_OBSERVATIONS.find(
    (o) => o.site === "pissebus" && o.date === "2026-08-19",
  )!;
  expect(compareAir(a, b)).toEqual({ low: -428.2, high: -402.2 });
  expect(compareAir(b, a)).toEqual({ low: 402.2, high: 428.2 });
  const same = compareAir(a, a);
  expect(same).toEqual({ low: 0, high: 0 });
  render(<FireComparison />);
  expect(screen.getByText(/−428,2 a −402,2/)).toBeTruthy();
});
it("records an explicit camera checklist separately from simulated availability", () => {
  const now = Date.parse("2026-11-10T10:00Z"),
    before = cameraOnline(CAMERAS[0]!.id, now);
  render(<CameraInstallation camera={CAMERAS[0]!} />);
  const save = screen.getByRole("button", { name: "Registra controllo demo" });
  expect(save).toHaveProperty("disabled", true);
  for (const name of [
    "Batterie e memoria",
    "Ottica libera e fissaggio",
    "Orologio e scatto di prova",
  ])
    fireEvent.click(screen.getByRole("button", { name }));
  fireEvent.click(save);
  expect(useNatureStore.getState().cameraChecks["cam-1"]?.note).toContain(
    "Esercitazione",
  );
  expect(cameraOnline("cam-1", now)).toBe(before);
});
it("adds filtered trees and opens the record without leaving the work task", () => {
  const trees: TreeFeature[] = ["Larix decidua", "Fagus sylvatica"].map(
    (specie, i) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [13.01 + i * 0.0002, 45.95] },
      properties: {
        __featureId: String(i),
        specie,
        prog: i + 1,
        familia: "Famiglia",
      },
    }),
  );
  useNatureStore.setState({ trees, treeQuery: "Larix" });
  useExperienceStore.setState({
    activeId: "park",
    tab: "tools",
    selectedId: null,
  });
  render(<ParkPanel tools />);
  fireEvent.click(
    screen.getByRole("button", { name: "Aggiungi 1 risultato al giro" }),
  );
  expect(useNatureStore.getState().plan).toEqual(["0"]);
  fireEvent.click(screen.getByRole("button", { name: /1\. Larix decidua/ }));
  expect(useExperienceStore.getState()).toMatchObject({
    tab: "tools",
    selectedId: "0",
  });
  expect(screen.getByRole("heading", { name: "Larix decidua" })).toBeTruthy();
});
it("exports usable coordinates and neutralises formulas in source/user text", () => {
  expect(csvCell(' =HYPERLINK("x")')).toBe('"\' =HYPERLINK(""x"")"');
  const t: TreeFeature = {
    type: "Feature",
    geometry: { type: "Point", coordinates: [13.01, 45.95] },
    properties: {
      __featureId: "t",
      prog: 7,
      specie: "Larix decidua",
      data_rilievo: "2001-01-01",
    },
  };
  const csv = parkWorklist([t], { t: { at: 0, note: "=1+2" } }, 8);
  expect(csv).toContain('"13.01";"45.95"');
  expect(csv).toContain('"\'=1+2"');
  expect(csv).toContain("1970-01-01T00:00:00.000Z");
});
it("uses small metric viewing sectors and well separated, non-grid stations", () => {
  const metres = (a: number[], b: number[]) =>
    Math.hypot(
      (a[0]! - b[0]!) * 111320 * Math.cos((a[1]! * Math.PI) / 180),
      (a[1]! - b[1]!) * 110574,
    );
  for (const c of CAMERAS) {
    expect(metres(c.coordinates, c.target)).toBeCloseTo(5, 0);
    const sector = cameraSector(c);
    for (const p of sector.geometry.coordinates[0]!)
      expect(metres(c.coordinates, p)).toBeLessThanOrEqual(12.01);
    for (const other of CAMERAS)
      if (other !== c)
        expect(metres(c.coordinates, other.coordinates)).toBeGreaterThan(200);
  }
});

it("aligns the initially displayed camera with the map selection", () => {
  useNatureStore.setState({ camera: "all", captureId: null });
  useExperienceStore.setState({
    activeId: "wildlife",
    tab: "tools",
    selectedId: null,
  });
  render(<WildlifePanel tools />);
  fireEvent.click(screen.getByRole("button", { name: /Controlla rete/ }));
  expect(useNatureStore.getState().camera).toBe("cam-1");
  expect(
    screen.getByRole("heading", {
      name: "Fototrappola 01 · installazione demo",
    }),
  ).toBeTruthy();
});
it("keeps the perimeter tool open when switching overlapping records", () => {
  const geometry: GeoJSON.Polygon = {
    type: "Polygon",
    coordinates: [
      [
        [13.07, 46.39],
        [13.08, 46.39],
        [13.08, 46.4],
        [13.07, 46.39],
      ],
    ],
  };
  useNatureStore.setState({
    fireData: {
      type: "FeatureCollection",
      features: [1, 2].map((id) => ({
        type: "Feature",
        geometry,
        properties: {
          id,
          AREA_HA: 10,
          COMMUNE: "Amaro",
          FIREDATE: "2026-08-10",
        },
      })),
    },
    coincidentIds: ["fire-1", "fire-2"],
    showPerimeters: false,
  });
  useExperienceStore.setState({
    activeId: "fire",
    tab: "tools",
    selectedId: "fire-1",
  });
  render(<FirePanel tools />);
  fireEvent.click(screen.getByRole("button", { name: /Consulta perimetri/ }));
  fireEvent.click(
    screen.getByRole("combobox", { name: "Schede satellitari sovrapposte" }),
  );
  fireEvent.click(screen.getByRole("option", { name: "EFFIS 2" }));
  expect(useExperienceStore.getState()).toMatchObject({
    tab: "tools",
    selectedId: "fire-2",
  });
  fireEvent.click(screen.getByRole("button", { name: "Mostra sulla mappa" }));
  expect(useNatureStore.getState().showPerimeters).toBe(true);
});

it("makes a planned tree visible before locating it when excluded by filters", () => {
  const tree: TreeFeature = {
    type: "Feature",
    geometry: { type: "Point", coordinates: [13.01, 45.95] },
    properties: {
      __featureId: "hidden",
      specie: "Larix decidua",
      familia: "Pinaceae",
    },
  };
  useNatureStore.setState({ treeQuery: "Quercus", family: "Fagaceae" });
  render(<TreeDetails tree={tree} />);
  fireEvent.click(screen.getByRole("button", { name: "Mostra sulla mappa" }));
  expect(useNatureStore.getState()).toMatchObject({
    treeQuery: "",
    family: "all",
  });
});
