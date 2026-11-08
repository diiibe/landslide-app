import { create } from "zustand";
import { useAppStore, type AppState } from "@/app/store";
import type { Measure, RadarFrame, Variable } from "./data";
export type TwinSelection =
  | { kind: "sensor"; stationId: number }
  | {
      kind: "asset";
      name: string;
      coordinates: [number, number];
      properties: Record<string, unknown>;
    }
  | { kind: "building"; properties: Record<string, unknown> };
export interface FeedState {
  loading: boolean;
  error: string | null;
  receivedAt: number | null;
  snapshot: boolean;
}
export const EMPTY_FEED: FeedState = {
  loading: false,
  error: null,
  receivedAt: null,
  snapshot: false,
};
interface TwinState {
  active: boolean;
  variable: Variable;
  radarOn: boolean;
  buildingsOn: boolean;
  assetsOn: boolean;
  autoRefresh: boolean;
  refreshKey: number;
  measures: Measure[];
  radar: RadarFrame | null;
  sensorsFeed: FeedState;
  radarFeed: FeedState;
  assetsError: string | null;
  buildingsError: string | null;
  selection: TwinSelection | null;
}
export const useTwinStore = create<TwinState>(() => ({
  active: false,
  variable: "wind",
  radarOn: true,
  buildingsOn: true,
  assetsOn: true,
  autoRefresh: true,
  refreshKey: 0,
  measures: [],
  radar: null,
  sensorsFeed: { ...EMPTY_FEED },
  radarFeed: { ...EMPTY_FEED },
  assetsError: null,
  buildingsError: null,
  selection: null,
}));
let previous: {
  layers: AppState["layers"];
  view3D: boolean;
  layersPanelOpen: boolean;
  basemapPanelOpen: boolean;
} | null = null;
export function setTwinActive(active: boolean): void {
  if (active === useTwinStore.getState().active) return;
  const app = useAppStore.getState();
  if (active) {
    previous = {
      layers: { ...app.layers },
      view3D: app.view3D,
      layersPanelOpen: app.layersPanelOpen,
      basemapPanelOpen: app.basemapPanelOpen,
    };
    const layers = Object.fromEntries(
      Object.keys(app.layers).map((k) => [k, false]),
    ) as AppState["layers"];
    useAppStore.setState({
      layers,
      view3D: true,
      drawerOpen: true,
      layersPanelOpen: false,
      basemapPanelOpen: false,
      drawingMode: false,
    });
  } else if (previous) {
    useAppStore.setState(previous);
    previous = null;
  }
  useTwinStore.setState({ active, selection: null });
}
