import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useAppStore } from "@/app/store";
import { useRegionalStore } from "@/regional/store";
import { useTwinStore } from "@/digital-twin/store";
import {
  leaveExperience,
  openExperience,
  selectObject,
  useExperienceStore,
} from "./store";

vi.mock("@/map/style", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/map/style")>(),
  HAS_MAPBOX_TOKEN: true,
}));

beforeEach(() => {
  leaveExperience();
  useAppStore.getState().reset();
  useRegionalStore.setState({
    enabled: { "pcr-wind": false, custom: true },
    opacity: { custom: 0.4 },
  });
  vi.stubGlobal("__mlmap", {
    getCenter: () => ({ lng: 13.7, lat: 45.6 }),
    getZoom: () => 12,
    getBearing: () => 18,
    getPitch: () => 35,
  });
});
afterEach(() => {
  leaveExperience();
  vi.unstubAllGlobals();
});

it("returns to the original territory view after changing between several spaces without replacing observations", () => {
  useAppStore.setState({
    basemap: "dark",
    drawerOpen: false,
    view3D: true,
    floodView: "P3",
    floodOpacity: 0.25,
  });
  const layers = useAppStore.getState().layers,
    observed = useTwinStore.getState().measures;
  openExperience("landslides");
  expect(useAppStore.getState().layers.v2Bodies).toBe(true);
  expect(useAppStore.getState().layers.roads).toBe(true);
  expect(useRegionalStore.getState().enabled.custom).not.toBe(true);
  openExperience("retail");
  expect(Object.values(useAppStore.getState().layers).some(Boolean)).toBe(
    false,
  );
  leaveExperience();
  const restored = useAppStore.getState();
  expect(restored.layers).toEqual(layers);
  expect(restored).toMatchObject({
    basemap: "dark",
    drawerOpen: false,
    view3D: true,
    floodView: "P3",
    floodOpacity: 0.25,
  });
  expect(restored.cameraRequest).toMatchObject({
    pitch: 35,
    bearing: 18,
    zoom: 12,
  });
  expect(useRegionalStore.getState().enabled).toMatchObject({
    "pcr-wind": false,
    custom: true,
  });
  expect(useRegionalStore.getState().opacity.custom).toBe(0.4);
  expect(useTwinStore.getState().measures).toBe(observed);
  expect(new URL(window.location.href).searchParams.has("space")).toBe(false);
});

it("reveals a selected sensor hidden by a different metric filter and stops playback on exit", () => {
  openExperience("traffic");
  expect(useExperienceStore.getState().filter).toBe("flow");
  selectObject("t-speed-0");
  expect(useExperienceStore.getState()).toMatchObject({
    selectedId: "t-speed-0",
    filter: "speed",
    tab: "overview",
  });
  expect(useAppStore.getState().drawerOpen).toBe(true);
  useExperienceStore.setState({
    replayTime: 1_000,
    playback: true,
    probe: true,
  });
  leaveExperience();
  expect(useExperienceStore.getState()).toMatchObject({
    activeId: null,
    replayTime: null,
    playback: false,
    probe: false,
  });
});

it("requests fresh real feeds on every entry without replacing observations or replaying an old demo instant",()=>{
 const original=useTwinStore.getState().measures;
 useTwinStore.setState({autoRefresh:false});
 const a=useTwinStore.getState().refreshKey,b=useRegionalStore.getState().refreshKey;
 openExperience("industry");
 expect(useTwinStore.getState()).toMatchObject({autoRefresh:true,refreshKey:a+1});
 expect(useRegionalStore.getState().refreshKey).toBe(b+1);
 useExperienceStore.setState({replayTime:1000});openExperience("retail");
 expect(useExperienceStore.getState().replayTime).toBeNull();
 expect(useTwinStore.getState().refreshKey).toBe(a+2);
 expect(useTwinStore.getState().measures).toBe(original);
});

it.each(["industry", "vineyard", "retail", "traffic", "mountain"] as const)(
  "opens %s on the dark basemap and restores the territory basemap on exit",
  (id) => {
    useAppStore.setState({ basemap: "light", theme: "light" });
    openExperience(id);
    expect(useAppStore.getState().basemap).toBe("dark");
    expect(useAppStore.getState().theme).toBe("light");
    useAppStore.getState().setBasemap("satellite");
    expect(useAppStore.getState().basemap).toBe("satellite");
    openExperience(id);
    expect(useAppStore.getState().basemap).toBe("dark");
    leaveExperience();
    expect(useAppStore.getState().basemap).toBe("light");
  },
);

it("keeps the landslide Space on the relief basemap", () => {
  openExperience("landslides");
  expect(useAppStore.getState().basemap).toBe("outdoors");
});
