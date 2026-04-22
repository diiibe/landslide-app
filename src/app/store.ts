import { create } from "zustand";
import type { Basemap, ModelId, Threshold, Zone } from "./types";

export type GroupId = "view" | "monitoring" | "analytics" | "model";

export interface AppState {
  model: ModelId;
  basemap: Basemap;
  threshold: Threshold;
  selectedZones: Zone[];
  layers: { susceptibility: boolean; iffi: boolean; zoneBoundaries: boolean; contours: boolean };
  drawerOpen: boolean;
  legendOpen: boolean;
  layersPanelOpen: boolean;
  groupOpen: Record<GroupId, boolean>;
  search: { query: string; placeName: string | null };
  setModel: (m: ModelId) => void;
  setBasemap: (b: Basemap) => void;
  setThreshold: (t: Threshold) => void;
  setSelectedZones: (z: Zone[]) => void;
  toggleZone: (z: Zone) => void;
  toggleLayer: (k: keyof AppState["layers"]) => void;
  toggleDrawer: () => void;
  toggleLegend: () => void;
  toggleLayersPanel: () => void;
  toggleGroup: (g: GroupId) => void;
  setSearch: (s: { query: string; placeName: string | null }) => void;
  reset: () => void;
}

const initial: Omit<
  AppState,
  | "setModel" | "setBasemap" | "setThreshold" | "setSelectedZones" | "toggleZone"
  | "toggleLayer" | "toggleDrawer" | "toggleLegend" | "toggleLayersPanel"
  | "toggleGroup" | "setSearch" | "reset"
> = {
  model: "j2",
  basemap: "outdoors",
  threshold: 0.5,
  selectedZones: [],
  layers: { susceptibility: true, iffi: true, zoneBoundaries: true, contours: false },
  drawerOpen: true,
  legendOpen: true,
  layersPanelOpen: true,
  groupOpen: { view: true, monitoring: true, analytics: true, model: true },
  search: { query: "", placeName: null },
};

export const useAppStore = create<AppState>((set) => ({
  ...initial,
  setModel: (m) => set({ model: m }),
  setBasemap: (b) => set({ basemap: b }),
  setThreshold: (t) => set({ threshold: t }),
  setSelectedZones: (z) => set({ selectedZones: z }),
  toggleZone: (z) =>
    set((s) =>
      s.selectedZones.includes(z)
        ? { selectedZones: s.selectedZones.filter((x) => x !== z) }
        : { selectedZones: [...s.selectedZones, z] },
    ),
  toggleLayer: (k) => set((s) => ({ layers: { ...s.layers, [k]: !s.layers[k] } })),
  toggleDrawer: () => set((s) => ({ drawerOpen: !s.drawerOpen })),
  toggleLegend: () => set((s) => ({ legendOpen: !s.legendOpen })),
  toggleLayersPanel: () => set((s) => ({ layersPanelOpen: !s.layersPanelOpen })),
  toggleGroup: (g) =>
    set((s) => ({ groupOpen: { ...s.groupOpen, [g]: !s.groupOpen[g] } })),
  setSearch: (search) => set({ search }),
  reset: () => set(initial),
}));
