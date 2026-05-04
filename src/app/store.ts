import { create } from "zustand";
import type { Basemap, ModelId, Theme, Threshold, Zone } from "./types";

export type GroupId = "view" | "monitoring" | "analytics" | "model";

const THEME_KEY = "fvg:theme";

function initialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(THEME_KEY);
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(t: Theme): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", t);
  try {
    window.localStorage.setItem(THEME_KEY, t);
  } catch {
    /* localStorage may be disabled — ignore */
  }
}

export interface AppState {
  model: ModelId;
  basemap: Basemap;
  threshold: Threshold;
  selectedZones: Zone[];
  layers: {
    susceptibility: boolean;
    smoothHeatmap: boolean;
    iffi: boolean;
    zoneBoundaries: boolean;
    roads: boolean;
    dtm: boolean;
    contours: boolean;
  };
  theme: Theme;
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
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
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
  | "toggleLayer" | "setTheme" | "toggleTheme" | "toggleDrawer" | "toggleLegend"
  | "toggleLayersPanel" | "toggleGroup" | "setSearch" | "reset"
> = {
  model: "j2",
  basemap: "outdoors",
  threshold: 0.5,
  selectedZones: [],
  layers: {
    susceptibility: true,
    smoothHeatmap: false,
    iffi: true,
    zoneBoundaries: true,
    roads: false,
    dtm: false,
    contours: false,
  },
  theme: initialTheme(),
  drawerOpen: true,
  legendOpen: true,
  layersPanelOpen: true,
  groupOpen: { view: true, monitoring: true, analytics: true, model: true },
  search: { query: "", placeName: null },
};

// Apply theme on module load (before React mounts) to avoid flash of light theme.
applyTheme(initial.theme);

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
  setTheme: (t) => {
    applyTheme(t);
    set({ theme: t });
  },
  toggleTheme: () =>
    set((s) => {
      const next: Theme = s.theme === "dark" ? "light" : "dark";
      applyTheme(next);
      return { theme: next };
    }),
  toggleDrawer: () => set((s) => ({ drawerOpen: !s.drawerOpen })),
  toggleLegend: () => set((s) => ({ legendOpen: !s.legendOpen })),
  toggleLayersPanel: () => set((s) => ({ layersPanelOpen: !s.layersPanelOpen })),
  toggleGroup: (g) =>
    set((s) => ({ groupOpen: { ...s.groupOpen, [g]: !s.groupOpen[g] } })),
  setSearch: (search) => set({ search }),
  reset: () => set(initial),
}));
