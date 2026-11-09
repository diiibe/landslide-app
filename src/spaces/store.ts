import { create } from "zustand";
import { HAS_MAPBOX_TOKEN } from "@/map/style";
import { useAppStore } from "@/app/store";
import { useRegionalStore } from "@/regional/store";
import { BUILTIN_LAYERS } from "@/regional/builtins";
import { captureView, restoreSpace, type Space } from "@/ui/spacesStore";
import { experience, polygonAt } from "./experiences";
import type { Metric, Scenario, ScenarioState, SpaceId } from "./types";
export interface AreaSelection {
  id: string;
  name: string;
  geometry: GeoJSON.Polygon;
  saved: boolean;
}
interface State {
  activeId: SpaceId | null;
  hubOpen: boolean;
  tab: "overview" | "layers";
  selectedId: string | null;
  area: AreaSelection | null;
  analysisTab: "distribution" | "context" | "compare";
  replayTime: number | null;
  scenario: ScenarioState;
  filter: Metric | "all";
  probe: boolean;
  playback: boolean;
  showZones: boolean;
  showSensors: boolean;
  showVehicles: boolean;
  contextError: string | null;
  contextReady: boolean;
}
export const useExperienceStore = create<State>(() => ({
  activeId: null,
  hubOpen: false,
  tab: "overview",
  selectedId: null,
  area: null,
  analysisTab: "distribution",
  replayTime: null,
  scenario: { id: "normal", since: 0 },
  filter: "all",
  probe: false,
  playback: false,
  showZones: true,
  showSensors: true,
  showVehicles: true,
  contextError: null,
  contextReady: false,
}));
let territory: Space | null = null;
let territoryDrawer = false;
function url(id: SpaceId | null) {
  const u = new URL(window.location.href);
  if (id) u.searchParams.set("space", id);
  else u.searchParams.delete("space");
  window.history.replaceState(null, "", u);
}
export function openExperience(id: SpaceId) {
  const scene = experience(id);
  if (!scene) return;
  if (!useExperienceStore.getState().activeId) {
    territory = captureView("Territorio");
    territoryDrawer = useAppStore.getState().drawerOpen;
  }
  useExperienceStore.setState({
    activeId: id,
    hubOpen: false,
    tab: "overview",
    selectedId: null,
    area: null,
    replayTime: null,
    scenario: { id: "normal", since: 0 },
    filter: id === "traffic" ? "flow" : "all",
    probe: false,
    playback: false,
    showZones: true,
    showSensors: true,
    showVehicles: true,
  });
  const a = useAppStore.getState(),
    r = useRegionalStore.getState();
  const layers = Object.fromEntries(
    Object.keys(a.layers).map((k) => [k, false]),
  ) as typeof a.layers;
  if (id === "landslides")
    Object.assign(layers, {
      v2Bodies: true,
      iffi: true,
      roads: true,
      trails: false,
      poiCritical: false,
      poiHuts: true,
    });
  const enabled = Object.fromEntries(
    [
      ...BUILTIN_LAYERS.map((l) => l.id),
      ...(r.catalog?.layers ?? []).map((l) => l.id),
    ].map((k) => [k, false]),
  );
  useRegionalStore.setState({ enabled, selection: null, detailId: null });
  useAppStore.setState({
    layers,
    ...(HAS_MAPBOX_TOKEN
      ? {
          basemap:
            id === "landslides"
              ? ("outdoors" as const)
              : ("satellite" as const),
        }
      : {}),
    drawerOpen: !(
      window.matchMedia?.(
        "(max-width:768px), (max-height:500px) and (pointer:coarse)",
      ).matches ?? false
    ),
    drawingMode: false,
    cameraRequest: {
      center: scene.center,
      zoom: scene.zoom,
      bearing: 0,
      pitch: 0,
    },
    view3D: false,
  });
  url(id);
}
export function leaveExperience() {
  const previous = territory;
  territory = null;
  useExperienceStore.setState({
    activeId: null,
    selectedId: null,
    area: null,
    probe: false,
    replayTime: null,
    playback: false,
    hubOpen: false,
    tab: "overview",
  });
  if (previous) {
    restoreSpace(previous);
    useAppStore.setState({ drawerOpen: territoryDrawer });
    if (!previous.camera)
      useAppStore.setState({
        cameraRequest: {
          center: [13.15, 46.35],
          zoom: 8.6,
          bearing: 0,
          pitch: 0,
        },
      });
  }
  url(null);
}
export function restoreView(view: Space) {
  const inferred =
    view.experienceId ??
    (view.layers.v2Bodies || view.layers.v2Diffuse ? "landslides" : null);
  if (inferred) openExperience(inferred);
  else if (useExperienceStore.getState().activeId) leaveExperience();
  restoreSpace(view);
  useExperienceStore.setState({ hubOpen: false });
}
export function selectObject(id: string | null) {
  const s = useExperienceStore.getState(),
    asset = experience(s.activeId)?.sensors.find((a) => a.id === id);
  useExperienceStore.setState({
    selectedId: id,
    tab: "overview",
    ...(asset && s.filter !== "all" && s.filter !== asset.metric
      ? { filter: asset.metric }
      : {}),
  });
  useAppStore.setState({ drawerOpen: true });
}
export function selectArea(area: AreaSelection) {
  useExperienceStore.setState({
    area,
    selectedId: null,
    tab: "overview",
    probe: false,
  });
  useAppStore.setState({ drawerOpen: true });
}
export function drawArea() {
  useExperienceStore.setState({ probe: false });
  useAppStore.getState().setDrawingMode(true);
}
export function setScenario(id: Scenario) {
  const t = useExperienceStore.getState().replayTime ?? Date.now();
  useExperienceStore.setState({
    scenario: { id, since: id === "normal" ? 0 : t - 30 * 60000 },
  });
}
export function demoTime() {
  return useExperienceStore.getState().replayTime ?? Date.now();
}
export function savedArea(id: string) {
  const p = useAppStore.getState().userPolygons.find((p) => p.id === id);
  if (p)
    selectArea({ id: p.id, name: p.name, geometry: p.geometry, saved: true });
}
export const AREA_PRESETS = [
  {
    id: "venzone",
    name: "Venzone · conoide e fondovalle",
    center: [13.138, 46.34] as [number, number],
    geometry: polygonAt(
      [13.138, 46.34],
      [
        [-1300, -1000],
        [1600, -1000],
        [1700, 1300],
        [-1200, 1500],
      ],
    ),
  },
  {
    id: "tolmezzo",
    name: "Tolmezzo · margine urbano",
    center: [13.016, 46.406] as [number, number],
    geometry: polygonAt(
      [13.016, 46.406],
      [
        [-1200, -1100],
        [1500, -1100],
        [1600, 1300],
        [-1200, 1400],
      ],
    ),
  },
  {
    id: "gemona",
    name: "Gemona · versante e abitato",
    center: [13.139, 46.283] as [number, number],
    geometry: polygonAt(
      [13.139, 46.283],
      [
        [-1100, -900],
        [1500, -1000],
        [1600, 1500],
        [-1000, 1300],
      ],
    ),
  },
];
