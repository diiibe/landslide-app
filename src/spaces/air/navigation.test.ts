import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Map as MLMap } from "maplibre-gl";
import { useAppStore } from "@/app/store";
import { useExperienceStore } from "../store";
import { useAirStore } from "./store";
import { airFixture } from "./testFixtures";
import { mountAirNavigation } from "./navigation";
import { AIR_EXPERIENCE } from "./experience";

let stop = () => {};
beforeEach(() => {
  vi.useFakeTimers();
  useExperienceStore.setState({ activeId: null });
  useAppStore.setState({ cameraRequest: null, view3D: false, drawingMode: false });
  useAirStore.setState({ data: null });
});
afterEach(() => {
  stop();
  document.body.replaceChildren();
  vi.useRealTimers();
});
function harness(width = 1440, height = 936, loaded = true) {
  const container = document.createElement("div");
  document.body.append(container);
  container.getBoundingClientRect = () => ({
    width, height, top: 64, bottom: 64 + height, left: 0, right: width,
  }) as DOMRect;
  const bounds = [[11.8, 45], [14.45, 47.15]];
  const map = {
    isStyleLoaded: () => loaded,
    getMaxBounds: () => ({ toArray: () => bounds }),
    setMaxBounds: vi.fn(),
    getContainer: () => container,
    getPadding: () => ({ left: 0, top: 0, bottom: 0, right: width > 768 ? 384 : 0 }),
    fitBounds: vi.fn(), on: vi.fn(), off: vi.fn(),
  };
  stop = mountAirNavigation(map as unknown as MLMap);
  return { map, bounds, container };
}
it("releases the regional camera fence only in Air and fits all study municipalities once", () => {
  const { map, bounds } = harness();
  useExperienceStore.setState({ activeId: "air" });
  expect(map.setMaxBounds).toHaveBeenLastCalledWith(null);
  vi.advanceTimersByTime(50);
  expect(map.fitBounds).not.toHaveBeenCalled();
  useAirStore.setState({ data: airFixture() });
  vi.advanceTimersByTime(50);
  expect(map.fitBounds).toHaveBeenCalledWith([[12, 45], [13, 46]], expect.objectContaining({
    duration: 0,
  }));
  useAirStore.setState({ data: airFixture(), measure: "no2" });
  useAppStore.setState({ drawerOpen: false });
  vi.advanceTimersByTime(50);
  expect(map.fitBounds).toHaveBeenCalledTimes(1);
  useExperienceStore.setState({ activeId: "landslides" });
  expect(map.setMaxBounds).toHaveBeenLastCalledWith(bounds);
});
it("reserves the commands and Space bar without duplicating the drawer padding", () => {
  const { map } = harness();
  const commands = document.createElement("div"), bar = document.createElement("div");
  commands.setAttribute("aria-label", "Comandi mappa");
  bar.setAttribute("data-map-space-bar", "");
  commands.getBoundingClientRect = () => ({ left: 828, bottom: 400, height: 324 }) as DOMRect;
  bar.getBoundingClientRect = () => ({ bottom: 132, height: 56 }) as DOMRect;
  document.body.append(commands, bar);
  useAirStore.setState({ data: airFixture() });
  useExperienceStore.setState({ activeId: "air" });
  vi.advanceTimersByTime(50);
  expect(map.fitBounds.mock.calls[0]?.[1].padding).toEqual({
    left: 32, right: 260, top: 88, bottom: 80,
  });
});
it("waits for the initial style and shared drawer padding before framing", () => {
  const { map } = harness(1440, 936, false);
  useExperienceStore.setState({ activeId: "air" });
  useAirStore.setState({ data: airFixture() });
  vi.advanceTimersByTime(50);
  expect(map.fitBounds).not.toHaveBeenCalled();
  const loaded = map.on.mock.calls.find(([event]) => event === "style.load")?.[1];
  loaded();
  vi.advanceTimersByTime(50);
  expect(map.fitBounds).toHaveBeenCalledTimes(1);
});
it("frames the study when entry resets a previous 3D view", () => {
  useAppStore.setState({ view3D: true });
  const { map } = harness();
  useAirStore.setState({ data: airFixture() });
  useExperienceStore.setState({ activeId: "air" });
  useAppStore.setState({ view3D: false, cameraRequest: {
    center: AIR_EXPERIENCE.center, zoom: AIR_EXPERIENCE.zoom, bearing: 0, pitch: 0,
  } });
  vi.advanceTimersByTime(50);
  expect(map.fitBounds).toHaveBeenCalledTimes(1);
});
it.each(["gesture", "keyboard", "saved view", "search"])("does not override a %s made before the data arrive", (kind) => {
  const { map, container } = harness(390, 780);
  useExperienceStore.setState({ activeId: "air" });
  if (kind === "gesture") container.dispatchEvent(new Event("pointerdown"));
  if (kind === "keyboard") {
    const move = map.on.mock.calls.find(([event]) => event === "movestart")?.[1];
    move({ originalEvent: new KeyboardEvent("keydown", { key: "ArrowRight" }) });
  }
  if (kind === "saved view") useAppStore.setState({
    cameraRequest: { center: [12.7, 45.95], zoom: 13, pitch: 35, bearing: 12 },
  });
  if (kind === "search") window.dispatchEvent(new Event("fvg:flyto"));
  useAirStore.setState({ data: airFixture() });
  vi.advanceTimersByTime(50);
  expect(map.fitBounds).not.toHaveBeenCalled();
});
it("cancels pending framing on exit and removes navigation work on disposal", () => {
  const { map, bounds } = harness();
  useAirStore.setState({ data: airFixture() });
  useExperienceStore.setState({ activeId: "air" });
  useExperienceStore.setState({ activeId: null });
  vi.advanceTimersByTime(50);
  expect(map.fitBounds).not.toHaveBeenCalled();
  expect(map.setMaxBounds).toHaveBeenLastCalledWith(bounds);
  useExperienceStore.setState({ activeId: "air" });
  stop(); stop = () => {};
  vi.advanceTimersByTime(50);
  expect(map.fitBounds).not.toHaveBeenCalled();
  expect(map.setMaxBounds).toHaveBeenLastCalledWith(bounds);
});
