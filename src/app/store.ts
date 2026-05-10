import { create } from "zustand";
import type { Basemap, ModelId, Theme, Threshold, Zone } from "./types";

export type GroupId = "view" | "monitoring" | "analytics" | "model";

const THEME_KEY = "fvg:theme";
const SENS_DEFAULTS_KEY = "fvg:sensitivity-defaults";

export type LayerNetwork = "roads" | "trails";

/** All three knobs that shape the road-risk pipeline.
 *  - `sensitivity`: paint-time linear scaler (cheap; no re-bake).
 *  - `gamma`: exponent on raw p before aggregation (`p_eff = p^γ`).
 *           γ>1 squashes mid p toward 0; γ<1 amplifies weak signals.
 *  - `radius`: square buffer in cell units around each vertex; the per-vertex
 *           value is the max p_eff inside the buffer. 0 = vertex only.
 *  Last two require walking the feature collection again (cheap, in-memory). */
export interface RiskParams {
  sensitivity: number;
  gamma: number;
  radius: number;
}

export type RiskParamsMap = Record<LayerNetwork, Record<ModelId, RiskParams>>;

export const SENS_MIN = 0.1;
export const SENS_MAX = 10;
export const GAMMA_MIN = 0.3;
export const GAMMA_MAX = 4;
export const RADIUS_MIN = 0;
export const RADIUS_MAX = 8;

const DEFAULT_PARAMS: RiskParams = { sensitivity: 1, gamma: 1.5, radius: 0 };

const HARD_DEFAULT: RiskParamsMap = {
  roads: { j2: { ...DEFAULT_PARAMS }, j3: { ...DEFAULT_PARAMS } },
  trails: { j2: { ...DEFAULT_PARAMS }, j3: { ...DEFAULT_PARAMS } },
};

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function clampParams(p: Partial<RiskParams> | undefined): RiskParams {
  return {
    sensitivity: clamp(Number(p?.sensitivity ?? DEFAULT_PARAMS.sensitivity), SENS_MIN, SENS_MAX),
    gamma: clamp(Number(p?.gamma ?? DEFAULT_PARAMS.gamma), GAMMA_MIN, GAMMA_MAX),
    radius: Math.round(clamp(Number(p?.radius ?? DEFAULT_PARAMS.radius), RADIUS_MIN, RADIUS_MAX)),
  };
}

function loadSensDefaults(): RiskParamsMap {
  if (typeof window === "undefined") return HARD_DEFAULT;
  try {
    const raw = window.localStorage.getItem(SENS_DEFAULTS_KEY);
    if (!raw) return HARD_DEFAULT;
    const parsed = JSON.parse(raw) as Partial<Record<LayerNetwork, Partial<Record<ModelId, Partial<RiskParams>>>>>;
    return {
      roads: {
        j2: clampParams(parsed.roads?.j2),
        j3: clampParams(parsed.roads?.j3),
      },
      trails: {
        j2: clampParams(parsed.trails?.j2),
        j3: clampParams(parsed.trails?.j3),
      },
    };
  } catch {
    return HARD_DEFAULT;
  }
}

function persistSensDefaults(s: RiskParamsMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SENS_DEFAULTS_KEY, JSON.stringify(s));
  } catch {
    /* localStorage may be disabled — ignore */
  }
}

export function paramsEqual(a: RiskParams, b: RiskParams): boolean {
  return (
    Math.abs(a.sensitivity - b.sensitivity) < 1e-3 &&
    Math.abs(a.gamma - b.gamma) < 1e-3 &&
    a.radius === b.radius
  );
}

function initialTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  const stored = window.localStorage.getItem(THEME_KEY);
  if (stored === "dark" || stored === "light") return stored;
  // First visit: respect OS-level preference. Fallback to dark — the operative
  // palette was tuned for it and is the safer default in a darker control room.
  try {
    if (
      typeof window.matchMedia === "function" &&
      !window.matchMedia("(prefers-color-scheme: dark)").matches &&
      window.matchMedia("(prefers-color-scheme: light)").matches
    ) {
      return "light";
    }
  } catch {
    /* matchMedia unavailable — fall through to dark default */
  }
  return "dark";
}

/**
 * Default drawer open-state. On narrow viewports (tablet/phone) the drawer
 * becomes a full-screen overlay sheet — opening by default would hide the map
 * on first paint. SSR-safe: returns `true` (the desktop default) when there's
 * no `window`.
 */
function initialDrawerOpen(): boolean {
  if (typeof window === "undefined") return true;
  try {
    if (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(max-width: 768px)").matches
    ) {
      return false;
    }
  } catch {
    /* matchMedia unavailable — fall through to desktop default */
  }
  return true;
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
    trails: boolean;
    comuni: boolean;
    poiCritical: boolean;
    poiHuts: boolean;
    dtm: boolean;
    contours: boolean;
  };
  /** Per-(network × model) risk shaping params. Live (mutable) state. */
  riskParams: RiskParamsMap;
  /** Per-(network × model) defaults persisted to localStorage. Loaded on
   *  startup; written when the user clicks the lock button. */
  riskParamsDefaults: RiskParamsMap;
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
  setRiskParam: (
    network: LayerNetwork,
    model: ModelId,
    key: keyof RiskParams,
    v: number,
  ) => void;
  /** Save the current `riskParams[network][model]` as the persistent default
   *  for that combination (writes to localStorage). */
  lockRiskParams: (network: LayerNetwork, model: ModelId) => void;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  toggleDrawer: () => void;
  toggleLegend: () => void;
  toggleLayersPanel: () => void;
  toggleGroup: (g: GroupId) => void;
  setSearch: (s: { query: string; placeName: string | null }) => void;
  reset: () => void;
}

const riskDefaults = loadSensDefaults();

const initial: Omit<
  AppState,
  | "setModel" | "setBasemap" | "setThreshold" | "setSelectedZones" | "toggleZone"
  | "toggleLayer" | "setRiskParam" | "lockRiskParams"
  | "setTheme" | "toggleTheme" | "toggleDrawer" | "toggleLegend"
  | "toggleLayersPanel" | "toggleGroup" | "setSearch" | "reset"
> = {
  model: "j3",
  basemap: "outdoors",
  threshold: 0.5,
  selectedZones: [],
  layers: {
    susceptibility: true,
    smoothHeatmap: true,
    iffi: true,
    zoneBoundaries: false,
    roads: false,
    trails: false,
    comuni: false,
    poiCritical: false,
    poiHuts: false,
    dtm: false,
    contours: false,
  },
  riskParams: {
    roads: { j2: { ...riskDefaults.roads.j2 }, j3: { ...riskDefaults.roads.j3 } },
    trails: { j2: { ...riskDefaults.trails.j2 }, j3: { ...riskDefaults.trails.j3 } },
  },
  riskParamsDefaults: riskDefaults,
  theme: initialTheme(),
  drawerOpen: initialDrawerOpen(),
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
  setRiskParam: (network, model, key, v) =>
    set((s) => {
      const current = s.riskParams[network][model];
      const updated = clampParams({ ...current, [key]: v });
      return {
        riskParams: {
          ...s.riskParams,
          [network]: { ...s.riskParams[network], [model]: updated },
        },
      };
    }),
  lockRiskParams: (network, model) =>
    set((s) => {
      const next: RiskParamsMap = {
        ...s.riskParamsDefaults,
        [network]: {
          ...s.riskParamsDefaults[network],
          [model]: { ...s.riskParams[network][model] },
        },
      };
      persistSensDefaults(next);
      return { riskParamsDefaults: next };
    }),
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
