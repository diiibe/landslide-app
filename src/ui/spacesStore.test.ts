import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { useAppStore } from "@/app/store";
import { useRegionalStore } from "@/regional/store";
import { useTwinStore } from "@/digital-twin/store";
import { saveSpace, restoreSpace, useSpaces } from "./spacesStore";
beforeEach(() => { useAppStore.getState().reset(); useSpaces.setState({ spaces: [], storageError: false }); useRegionalStore.setState({ enabled: { "pcr-wind": true }, display: {}, opacity: {} }); });
afterEach(() => vi.restoreAllMocks());
it("restores a view without freezing or replacing observed data", () => {
  saveSpace("Costa"); const saved = useSpaces.getState().spaces[0]!;
  useAppStore.setState({ basemap: "dark" }); useRegionalStore.setState({ enabled: { other: true } });
  const observations = useTwinStore.getState().measures;
  restoreSpace(saved);
  expect(useRegionalStore.getState().enabled["pcr-wind"]).toBe(true);
  expect(useRegionalStore.getState().enabled.other).toBeUndefined();
  expect(useAppStore.getState().basemap).toBe(saved.basemap);
  expect(useTwinStore.getState().measures).toBe(observations);
  expect(JSON.parse(localStorage.getItem("friulview:spaces:v1")!)[0].name).toBe("Costa");
});
it("keeps a space available with an honest warning if persistence fails", () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw Error("quota"); });
  saveSpace("Vista locale");
  expect(useSpaces.getState().spaces[0]?.name).toBe("Vista locale");
  expect(useSpaces.getState().storageError).toBe(true);
});

it("restores hazard styling, POI settings and queues the exact camera", () => {
  vi.stubGlobal("__mlmap", { getCenter: () => ({ lng: 13.7, lat: 45.6 }), getZoom: () => 12, getBearing: () => 18, getPitch: () => 35 });
  const poiCategoryVisible = { ...useAppStore.getState().poiCategoryVisible, hospital: false };
  useAppStore.setState({ floodView: "P3", floodOpacity: .25, view3D: true, poiCategoryVisible });
  saveSpace("Rischio"); const s = useSpaces.getState().spaces[0]!;
  useAppStore.setState({ floodView: "combined", floodOpacity: 1, view3D: false });
  restoreSpace(s);
  expect(useAppStore.getState().floodView).toBe("P3");
  expect(useAppStore.getState().floodOpacity).toBe(.25);
  expect(useAppStore.getState().poiCategoryVisible).toEqual(poiCategoryVisible);
  expect(useAppStore.getState().cameraRequest?.pitch).toBe(35);
  vi.unstubAllGlobals();
});

it("records implicit default layers explicitly so space counts and future restores agree", () => {
  useRegionalStore.setState({ enabled: {} });
  saveSpace("Default");
  expect(useSpaces.getState().spaces[0]?.enabled["pcr-wind"]).toBe(true);
});

it("preserves non-contiguous class visibility, including no classes, in saved views", () => {
 const style=useAppStore.getState().susceptibilityStyle;
 useAppStore.setState({susceptibilityStyle:{bodies:{...style.bodies,classes:[2,5],minClass:2},diffuse:{...style.diffuse,classes:[],minClass:1}}});
 saveSpace("Classi libere");const saved=useSpaces.getState().spaces[0]!;
 useAppStore.getState().reset();restoreSpace(saved);
 expect(useAppStore.getState().susceptibilityStyle.bodies.classes).toEqual([2,5]);
 expect(useAppStore.getState().susceptibilityStyle.diffuse.classes).toEqual([]);
 const legacy=structuredClone(saved);delete legacy.susceptibilityStyle.bodies.classes;legacy.susceptibilityStyle.bodies.minClass=3;
 restoreSpace(legacy);expect(useAppStore.getState().susceptibilityStyle.bodies.classes).toEqual([3,4,5]);
});
