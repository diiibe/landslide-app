import { create } from "zustand";
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
  active: true,
  variable: "wind",
  radarOn: false,
  buildingsOn: false,
  assetsOn: false,
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
/** Compatibility API: never changes hazard layers, terrain or the camera. */
export function setTwinActive(active: boolean): void {
  useTwinStore.setState({ active });
}
