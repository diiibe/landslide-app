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

/** Coerce a single field to a finite number, falling back to the default.
 *  Bare `Number(p?.x ?? d)` returns NaN for non-numeric strings, `null`,
 *  `undefined` after the `??`, or already-NaN values — and `clamp(NaN, ...)`
 *  propagates NaN unchanged. Guard with `Number.isFinite` so malformed
 *  localStorage payloads can't slip past validation (P2.13). */
function coerceFinite(v: unknown, d: number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : d;
}

function clampParams(p: Partial<RiskParams> | undefined): RiskParams {
  return {
    sensitivity: clamp(
      coerceFinite(p?.sensitivity, DEFAULT_PARAMS.sensitivity),
      SENS_MIN,
      SENS_MAX,
    ),
    gamma: clamp(coerceFinite(p?.gamma, DEFAULT_PARAMS.gamma), GAMMA_MIN, GAMMA_MAX),
    radius: Math.round(
      clamp(coerceFinite(p?.radius, DEFAULT_PARAMS.radius), RADIUS_MIN, RADIUS_MAX),
    ),
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

/**
 * Default LayersPanel open-state. SSR-safe: returns `true` (the desktop
 * default) when there's no `window`. Mobile defaults to collapsed (P0.6).
 */
function initialLayersPanelOpen(): boolean {
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

/**
 * Default open state for the floating panels that appear next to the
 * LayersPanel (Sensitivity, Comune filter). They mount conditionally on
 * the underlying layer being active; this flag controls whether the body
 * is expanded or just the head is showing. Mirror the LayersPanel default.
 */
function initialFloatingPanelOpen(): boolean {
  return initialLayersPanelOpen();
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
  /** Open state of the floating "Sensitivity" panel that hosts the
   *  per-network risk shaping sliders. The panel mounts conditionally on
   *  `layers.roads || layers.trails`; this flag governs body expansion. */
  sensitivityPanelOpen: boolean;
  /** Open state of the floating "Comune filter" panel that lets the user
   *  pick comuni to restrict the choropleth. Mounts conditionally on
   *  `layers.comuni`; this flag governs body expansion. */
  comuneFilterPanelOpen: boolean;
  /** ISTAT codes of comuni selected via the filter panel. Empty array =
   *  no filter (show every comune). */
  selectedComuni: string[];
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
  toggleSensitivityPanel: () => void;
  toggleComuneFilterPanel: () => void;
  setSelectedComuni: (istatCodes: string[]) => void;
  toggleComune: (istat: string) => void;
  clearComuni: () => void;
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
  | "toggleLayersPanel" | "toggleSensitivityPanel" | "toggleComuneFilterPanel"
  | "setSelectedComuni" | "toggleComune" | "clearComuni"
  | "toggleGroup" | "setSearch" | "reset"
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
  layersPanelOpen: initialLayersPanelOpen(),
  sensitivityPanelOpen: initialFloatingPanelOpen(),
  comuneFilterPanelOpen: initialFloatingPanelOpen(),
  selectedComuni: [],
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
  toggleSensitivityPanel: () =>
    set((s) => ({ sensitivityPanelOpen: !s.sensitivityPanelOpen })),
  toggleComuneFilterPanel: () =>
    set((s) => ({ comuneFilterPanelOpen: !s.comuneFilterPanelOpen })),
  setSelectedComuni: (istatCodes) => set({ selectedComuni: istatCodes }),
  toggleComune: (istat) =>
    set((s) =>
      s.selectedComuni.includes(istat)
        ? { selectedComuni: s.selectedComuni.filter((x) => x !== istat) }
        : { selectedComuni: [...s.selectedComuni, istat] },
    ),
  clearComuni: () => set({ selectedComuni: [] }),
  toggleGroup: (g) =>
    set((s) => ({ groupOpen: { ...s.groupOpen, [g]: !s.groupOpen[g] } })),
  setSearch: (search) => set({ search }),
  reset: () => set(initial),
}));

/**
 * P2.14 — cross-tab sync of riskParamsDefaults via the browser `storage`
 * event. The store captures `riskParamsDefaults` once at module load
 * (via `loadSensDefaults()`), so when tab A locks a parameter via
 * `lockRiskParams`, tab B's snapshot stays stale and its lock indicator
 * shows "dirty" forever until reload. Listen for the storage event that
 * fires in other tabs (the writing tab itself does not receive it), and
 * re-hydrate from the persisted payload.
 */
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== SENS_DEFAULTS_KEY) return;
    // A `null` newValue means the key was cleared; reload from scratch
    // (which falls back to HARD_DEFAULT) to stay consistent.
    useAppStore.setState({ riskParamsDefaults: loadSensDefaults() });
  });
}
