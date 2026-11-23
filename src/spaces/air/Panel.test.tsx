import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AirMapUI, AirPanel } from "./Panel";
import { adoptAirData, setAirLayer, useAirStore } from "./store";
import { useExperienceStore } from "../store";
import { useAppStore } from "@/app/store";
import { airFixture, contextFixture } from "./testFixtures";
beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  useExperienceStore.setState({ activeId: "air", tab: "layers" });
  useAppStore.setState({ drawerOpen: true, drawingMode: false });
  useAirStore.setState({
    ...useAirStore.getInitialState(),
    context: contextFixture,
  });
  adoptAirData(airFixture());
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  useExperienceStore.setState({ activeId: null });
});
it("moves the date range between mobile drawer and map without duplicate IDs", () => {
  setAirLayer("observations", true);
  render(
    <>
      <AirPanel />
      <AirMapUI />
    </>,
  );
  expect(document.querySelectorAll("#air-date-range")).toHaveLength(1);
  act(() => useAppStore.setState({ drawerOpen: false }));
  expect(document.querySelectorAll("#air-date-range")).toHaveLength(1);
  act(() => setAirLayer("observations", false));
  expect(document.querySelectorAll("#air-date-range")).toHaveLength(0);
});
it("keeps questions and map controls coherent when a group is released", () => {
  render(
    <>
      <AirPanel />
      <AirMapUI />
    </>,
  );
  const question = screen.getByRole("button", { name: /^Che aria misurano/ });
  fireEvent.click(question);
  expect(question.getAttribute("aria-pressed")).toBe("true");
  expect(
    document.querySelector("#air-map-controls")?.hasAttribute("hidden"),
  ).toBe(false);
  act(() => useAppStore.setState({ drawerOpen: true }));
  fireEvent.click(question);
  expect(question.getAttribute("aria-pressed")).toBe("false");
  expect(
    document.querySelector("#air-map-controls")?.hasAttribute("hidden"),
  ).toBe(true);
});
