// @vitest-environment jsdom
import { it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { AirChart } from "./FirePanel";
import { CaptureReview } from "./WildlifePanel";
import { TreeDetails } from "./ParkPanel";
import { useNatureStore, type TreeFeature } from "./store";
import { captures, captureLabel } from "./wildlife";
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
  useNatureStore.setState({ reviews: {}, plan: [], inspections: {} });
});
it("lets the reader inspect the actual PM10 interval and later independent point", () => {
  render(<AirChart station="pissebus" />);
  expect(screen.getByText(/416–442 µg\/m³/)).toBeTruthy();
  fireEvent.change(screen.getByRole("slider", { name: "Campione PM10" }), {
    target: { value: "3" },
  });
  expect(screen.getByText(/13,8 µg\/m³/)).toBeTruthy();
});
it("corrects a simulated classifier result without mutating the capture or confidence", () => {
  const c = captures(Date.parse("2026-11-10T12:00:00Z"))[0]!,
    original = structuredClone(c);
  render(<CaptureReview capture={c} />);
  fireEvent.click(
    screen.getByRole("combobox", { name: "Correzione della specie" }),
  );
  fireEvent.click(screen.getByRole("option", { name: "Non identificabile" }));
  fireEvent.click(screen.getByRole("button", { name: "Salva revisione demo" }));
  expect(captureLabel(c, useNatureStore.getState().reviews[c.id])).toBe(
    "unknown",
  );
  expect(c).toEqual(original);
  expect(screen.getByText(/Revisionata nella sessione/).textContent).toContain(
    "Non identificabile",
  );
});
it("keeps a demonstration inspection separate from the historical ERPAC state", () => {
  const tree: TreeFeature = {
      type: "Feature",
      geometry: { type: "Point", coordinates: [13.01, 45.95] },
      properties: {
        __featureId: "test-tree",
        prog: 7,
        specie: "Fagus sylvatica",
        stt_st: "potenzialmente instabile",
        data_rilievo: "2001-02-01",
      },
    },
    snapshot = structuredClone(tree);
  render(<TreeDetails tree={tree} />);
  fireEvent.click(screen.getByText("Annotazione di sopralluogo simulato"));
  fireEvent.change(
    screen.getByRole("textbox", { name: "Nota del sopralluogo simulato" }),
    { target: { value: "Esercitazione: verificare etichetta." } },
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Registra sopralluogo demo" }),
  );
  expect(useNatureStore.getState().plan).toEqual(["test-tree"]);
  expect(useNatureStore.getState().inspections["test-tree"]?.note).toContain(
    "Esercitazione",
  );
  expect(tree).toEqual(snapshot);
  expect(screen.getAllByText("potenzialmente instabile")[0]).toBeTruthy();
});

it("keeps the extension open when filtering the camera", async () => {
  const { SpacePanel } = await import("../SpacePanel");
  const { useExperienceStore } = await import("../store");
  useExperienceStore.setState({
    activeId: "wildlife",
    tab: "tools",
    selectedId: null,
  });
  render(<SpacePanel />);
  fireEvent.click(screen.getByRole("combobox", { name: "Fototrappola" }));
  fireEvent.click(screen.getByRole("option", { name: "Fototrappola 01" }));
  expect(useExperienceStore.getState().tab).toBe("tools");
  expect(
    screen.getByRole("button", { name: /Revisiona catture/ }),
  ).toBeTruthy();
  useExperienceStore.setState({ activeId: null });
});
it("focuses the inspected tree instead of returning to the Space heading", async () => {
  const { SpacePanel } = await import("../SpacePanel");
  const { useExperienceStore } = await import("../store");
  const tree: TreeFeature = {
    type: "Feature",
    geometry: { type: "Point", coordinates: [13.01, 45.95] },
    properties: {
      __featureId: "focus-tree",
      prog: 8,
      specie: "Fagus sylvatica",
      familia: "Fagaceae",
    },
  };
  useNatureStore.setState({
    trees: [tree],
    treeLoading: false,
    treeQuery: "",
    family: "all",
  });
  useExperienceStore.setState({
    activeId: "park",
    tab: "overview",
    selectedId: null,
  });
  const raf = vi
    .spyOn(window, "requestAnimationFrame")
    .mockImplementation((cb) => {
      cb(0);
      return 1;
    });
  render(<SpacePanel />);
  fireEvent.click(screen.getByRole("button", { name: /Fagus sylvatica/ }));
  expect(document.activeElement?.textContent).toBe("Fagus sylvatica");
  raf.mockRestore();
  useExperienceStore.setState({ activeId: null });
});
