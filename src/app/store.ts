import { create } from "zustand";
import {
  POI_CATEGORIES,
  POI_DEFAULT_COLORS,
  type Basemap,
  type ModelId,
  type PoiCategory,
  type Theme,
  type Threshold,
  type UserLayer,
  type UserPolygon,
  type Zone,
} from "./types";

export type GroupId = "view" | "monitoring" | "analytics" | "model";

/** Collapsible sections inside the LayersPanel's overlay list. Names
 *  map to the user-facing labels (Italian) but the ids stay English-
 *  agnostic for stability. Each group's open/close is independent and
 *  persists via the existing localStorage user-data key so the panel
 *  reopens in the same shape across sessions. */
export type OverlayGroup = "landslide" | "flood" | "context";

const THEME_KEY = "fvg:theme";
const SENS_DEFAULTS_KEY = "fvg:sensitivity-defaults";
const USER_DATA_KEY = "fvg:user-data";

/** Bright, high-contrast palette assigned round-robin to new user layers
 *  and drawn polygons. Hand-picked so they stay readable on light AND
 *  dark basemaps and don't collide with the susceptibility ramp. */
export const USER_COLOR_PALETTE: readonly string[] = [
  "#FF3FA4", // hot pink
  "#00E0D6", // electric cyan
  "#FFD400", // safety yellow
  "#7CFC00", // lawn green
  "#FF7A00", // saturated orange
  "#A88BFF", // lavender
  "#3F8CFF", // azure
  "#FF4D4D", // bright red
];

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

interface PersistedUserData {
  layers: UserLayer[];
  polygons: UserPolygon[];
  poiColors?: Record<string, string>;
  poiCategoryVisible?: Record<string, boolean>;
}

/** Best-effort load of user uploads + drawn polygons from localStorage.
 *  Returns empty arrays on missing/corrupt payload — the user's data is
 *  important but not critical to render the app at all. */
function loadUserData(): PersistedUserData {
  if (typeof window === "undefined") return { layers: [], polygons: [] };
  try {
    const raw = window.localStorage.getItem(USER_DATA_KEY);
    if (!raw) return { layers: [], polygons: [] };
    const parsed = JSON.parse(raw) as Partial<PersistedUserData>;
    const base: PersistedUserData = {
      layers: Array.isArray(parsed.layers) ? parsed.layers : [],
      polygons: Array.isArray(parsed.polygons) ? parsed.polygons : [],
    };
    if (parsed.poiColors && typeof parsed.poiColors === "object") {
      base.poiColors = parsed.poiColors;
    }
    if (parsed.poiCategoryVisible && typeof parsed.poiCategoryVisible === "object") {
      base.poiCategoryVisible = parsed.poiCategoryVisible;
    }
    return base;
  } catch {
    return { layers: [], polygons: [] };
  }
}

function persistUserData(d: PersistedUserData): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(USER_DATA_KEY, JSON.stringify(d));
  } catch {
    // QuotaExceededError is realistic here (a 5 MB GPX bundle saved into
    // the same key). The store stays consistent in memory; persistence
    // just lapses silently for the offending payload.
  }
}

/** Reads the current user-owned slice and persists it. Used by every
 *  action that touches userLayers / userPolygons / poiColors /
 *  poiCategoryVisible so we never silently drop a sibling field when
 *  one of them updates. */
function persistFromState(s: {
  userLayers: UserLayer[];
  userPolygons: UserPolygon[];
  poiColors: Record<PoiCategory, string>;
  poiCategoryVisible: Record<PoiCategory, boolean>;
}): void {
  persistUserData({
    layers: s.userLayers,
    polygons: s.userPolygons,
    poiColors: s.poiColors,
    poiCategoryVisible: s.poiCategoryVisible,
  });
}

/** Generate a stable, sortable id for new user layers / polygons. */
function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

/** Round-robin colour assignment off USER_COLOR_PALETTE so each new
 *  upload / drawn polygon gets a distinct hue without the user picking. */
function nextUserColor(usedSoFar: string[]): string {
  const pal = USER_COLOR_PALETTE;
  const counts = new Map<string, number>(pal.map((c) => [c, 0]));
  for (const c of usedSoFar) counts.set(c, (counts.get(c) ?? 0) + 1);
  let best = pal[0]!;
  let bestN = Infinity;
  for (const c of pal) {
    const n = counts.get(c) ?? 0;
    if (n < bestN) {
      bestN = n;
      best = c;
    }
  }
  return best;
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
    flood: boolean;
    pai: boolean;
    diff: boolean;
    floodHistorical: boolean;
  };
  /** Which flood overlay variant to render when `layers.flood` is on.
   *  See `src/map/layers/floodSusceptibility.ts` for the semantics of
   *  each value. */
  floodView: "combined" | "P3" | "P2plus" | "P1plus";
  /** 0–1 opacity for the flood raster overlay. */
  floodOpacity: number;
  /** 0–1 opacity for the PAI ground-truth raster overlay. */
  paiOpacity: number;
  /** 0–1 opacity for the model-vs-PAI difference raster overlay. */
  diffOpacity: number;
  /** Per-(network × model) risk shaping params. Live (mutable) state. */
  riskParams: RiskParamsMap;
  /** Per-(network × model) defaults persisted to localStorage. Loaded on
   *  startup; written when the user clicks the lock button. */
  riskParamsDefaults: RiskParamsMap;
  theme: Theme;
  drawerOpen: boolean;
  legendOpen: boolean;
  layersPanelOpen: boolean;
  /** Open state for the floating Basemap picker that sits in the
   *  right-hand stack directly below the LayersPanel. Defaults to open
   *  on desktop, closed on phones so the map shows on first paint
   *  (same heuristic as `layersPanelOpen`). */
  basemapPanelOpen: boolean;
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
  /** User-uploaded tracks / overlays (GPX, GeoJSON). Rendered as the
   *  topmost map layers via the glow + halo + stroke stack. */
  userLayers: UserLayer[];
  /** User-drawn polygons with frozen stats taken at the moment of save. */
  userPolygons: UserPolygon[];
  /** True while the polygon-drawing tool is active. UI shows a hint and
   *  the map captures clicks/taps via terra-draw. */
  drawingMode: boolean;
  /** Toggle for the 3D oblique-camera view. When on, the map enables
   *  terrain (raster-dem exaggerated 1.5×) and tilts the camera to ~60°
   *  pitch; when off it returns to the flat 0° top-down view. */
  view3D: boolean;
  /** Per-category colour for the gaussian POI balls. Defaults to
   *  POI_DEFAULT_COLORS; user-editable via the PoiLegendPanel. */
  poiColors: Record<PoiCategory, string>;
  /** Per-category visibility toggles. Independent from the group-level
   *  `layers.poiCritical`/`layers.poiHuts` master switches — those gate
   *  the whole group, this gates individual categories within. */
  poiCategoryVisible: Record<PoiCategory, boolean>;
  groupOpen: Record<GroupId, boolean>;
  /** Per-section open state for the collapsible overlay categories in
   *  the LayersPanel (Frane / Alluvioni / Contesto). Defaults to only
   *  "landslide" open — the other two collapse to a single row each
   *  so the panel doesn't dominate the viewport on first load. */
  overlayGroupOpen: Record<OverlayGroup, boolean>;
  search: { query: string; placeName: string | null };
  setModel: (m: ModelId) => void;
  setBasemap: (b: Basemap) => void;
  setThreshold: (t: Threshold) => void;
  setSelectedZones: (z: Zone[]) => void;
  toggleZone: (z: Zone) => void;
  toggleLayer: (k: keyof AppState["layers"]) => void;
  setFloodView: (v: AppState["floodView"]) => void;
  setFloodOpacity: (o: number) => void;
  setPaiOpacity: (o: number) => void;
  setDiffOpacity: (o: number) => void;
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
  toggleBasemapPanel: () => void;
  toggleSensitivityPanel: () => void;
  toggleComuneFilterPanel: () => void;
  setSelectedComuni: (istatCodes: string[]) => void;
  toggleComune: (istat: string) => void;
  clearComuni: () => void;
  /* user uploads + drawings */
  addUserLayer: (
    layer: Omit<UserLayer, "id" | "color" | "opacity" | "visible" | "createdAt"> & {
      color?: string;
    },
  ) => UserLayer;
  removeUserLayer: (id: string) => void;
  updateUserLayer: (id: string, patch: Partial<UserLayer>) => void;
  addUserPolygon: (
    polygon: Omit<UserPolygon, "id" | "color" | "createdAt"> & {
      color?: string;
    },
  ) => UserPolygon;
  removeUserPolygon: (id: string) => void;
  updateUserPolygon: (id: string, patch: Partial<UserPolygon>) => void;
  setDrawingMode: (on: boolean) => void;
  setView3D: (on: boolean) => void;
  toggleView3D: () => void;
  setPoiColor: (category: PoiCategory, hex: string) => void;
  resetPoiColors: () => void;
  togglePoiCategory: (category: PoiCategory) => void;
  toggleGroup: (g: GroupId) => void;
  toggleOverlayGroup: (g: OverlayGroup) => void;
  setSearch: (s: { query: string; placeName: string | null }) => void;
  reset: () => void;
}

const riskDefaults = loadSensDefaults();
const userData = loadUserData();

const initial: Omit<
  AppState,
  | "setModel" | "setBasemap" | "setThreshold" | "setSelectedZones" | "toggleZone"
  | "toggleLayer" | "setFloodView" | "setFloodOpacity" | "setPaiOpacity" | "setDiffOpacity" | "setRiskParam" | "lockRiskParams"
  | "setTheme" | "toggleTheme" | "toggleDrawer" | "toggleLegend"
  | "toggleLayersPanel" | "toggleBasemapPanel" | "toggleSensitivityPanel" | "toggleComuneFilterPanel"
  | "setSelectedComuni" | "toggleComune" | "clearComuni"
  | "addUserLayer" | "removeUserLayer" | "updateUserLayer"
  | "addUserPolygon" | "removeUserPolygon" | "updateUserPolygon" | "setDrawingMode"
  | "setView3D" | "toggleView3D"
  | "setPoiColor" | "resetPoiColors" | "togglePoiCategory"
  | "toggleGroup" | "toggleOverlayGroup" | "setSearch" | "reset"
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
    flood: false,
    pai: false,
    diff: false,
    floodHistorical: false,
  },
  floodView: "combined",
  floodOpacity: 0.85,
  paiOpacity: 0.85,
  diffOpacity: 0.9,
  riskParams: {
    roads: { j2: { ...riskDefaults.roads.j2 }, j3: { ...riskDefaults.roads.j3 } },
    trails: { j2: { ...riskDefaults.trails.j2 }, j3: { ...riskDefaults.trails.j3 } },
  },
  riskParamsDefaults: riskDefaults,
  theme: initialTheme(),
  drawerOpen: initialDrawerOpen(),
  legendOpen: true,
  layersPanelOpen: initialLayersPanelOpen(),
  basemapPanelOpen: initialLayersPanelOpen(),
  sensitivityPanelOpen: initialFloatingPanelOpen(),
  comuneFilterPanelOpen: initialFloatingPanelOpen(),
  selectedComuni: [],
  userLayers: userData.layers,
  userPolygons: userData.polygons,
  drawingMode: false,
  view3D: false,
  poiColors: {
    ...POI_DEFAULT_COLORS,
    ...((userData.poiColors ?? {}) as Partial<Record<PoiCategory, string>>),
  },
  poiCategoryVisible: (() => {
    const base = Object.fromEntries(POI_CATEGORIES.map((c) => [c, true])) as Record<
      PoiCategory,
      boolean
    >;
    const stored = (userData.poiCategoryVisible ?? {}) as Partial<Record<PoiCategory, boolean>>;
    for (const c of POI_CATEGORIES) {
      const v = stored[c];
      if (typeof v === "boolean") base[c] = v;
    }
    return base;
  })(),
  groupOpen: { view: true, monitoring: true, analytics: true, model: true },
  overlayGroupOpen: { landslide: true, flood: false, context: false },
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
  setFloodView: (v) => set({ floodView: v }),
  setFloodOpacity: (o) => set({ floodOpacity: Math.max(0, Math.min(1, o)) }),
  setPaiOpacity: (o) => set({ paiOpacity: Math.max(0, Math.min(1, o)) }),
  setDiffOpacity: (o) => set({ diffOpacity: Math.max(0, Math.min(1, o)) }),
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
  toggleBasemapPanel: () => set((s) => ({ basemapPanelOpen: !s.basemapPanelOpen })),
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
  addUserLayer: (input) => {
    const usedColors = useAppStore.getState().userLayers.map((l) => l.color);
    const layer: UserLayer = {
      id: uid("ul"),
      color: input.color ?? nextUserColor(usedColors),
      opacity: 1,
      visible: true,
      createdAt: Date.now(),
      name: input.name,
      kind: input.kind,
      data: input.data,
      bounds: input.bounds,
    };
    set((s) => {
      const next = [layer, ...s.userLayers];
      persistFromState({ ...s, userLayers: next });
      return { userLayers: next };
    });
    return layer;
  },
  removeUserLayer: (id) =>
    set((s) => {
      const next = s.userLayers.filter((l) => l.id !== id);
      persistFromState({ ...s, userLayers: next });
      return { userLayers: next };
    }),
  updateUserLayer: (id, patch) =>
    set((s) => {
      const next = s.userLayers.map((l) => (l.id === id ? { ...l, ...patch } : l));
      persistFromState({ ...s, userLayers: next });
      return { userLayers: next };
    }),
  addUserPolygon: (input) => {
    const usedColors = useAppStore.getState().userPolygons.map((p) => p.color);
    const polygon: UserPolygon = {
      id: uid("up"),
      color: input.color ?? nextUserColor(usedColors),
      createdAt: Date.now(),
      name: input.name,
      geometry: input.geometry,
      bounds: input.bounds,
      stats: input.stats,
    };
    set((s) => {
      const next = [polygon, ...s.userPolygons];
      persistFromState({ ...s, userPolygons: next });
      return { userPolygons: next };
    });
    return polygon;
  },
  removeUserPolygon: (id) =>
    set((s) => {
      const next = s.userPolygons.filter((p) => p.id !== id);
      persistFromState({ ...s, userPolygons: next });
      return { userPolygons: next };
    }),
  updateUserPolygon: (id, patch) =>
    set((s) => {
      const next = s.userPolygons.map((p) => (p.id === id ? { ...p, ...patch } : p));
      persistFromState({ ...s, userPolygons: next });
      return { userPolygons: next };
    }),
  setDrawingMode: (on) => set({ drawingMode: on }),
  setView3D: (on) => set({ view3D: on }),
  toggleView3D: () => set((s) => ({ view3D: !s.view3D })),
  setPoiColor: (category, hex) =>
    set((s) => {
      const next = { ...s.poiColors, [category]: hex };
      persistFromState({ ...s, poiColors: next });
      return { poiColors: next };
    }),
  resetPoiColors: () =>
    set((s) => {
      const next = { ...POI_DEFAULT_COLORS };
      persistFromState({ ...s, poiColors: next });
      return { poiColors: next };
    }),
  togglePoiCategory: (category) =>
    set((s) => {
      const next = { ...s.poiCategoryVisible, [category]: !s.poiCategoryVisible[category] };
      persistFromState({ ...s, poiCategoryVisible: next });
      return { poiCategoryVisible: next };
    }),
  toggleGroup: (g) =>
    set((s) => ({ groupOpen: { ...s.groupOpen, [g]: !s.groupOpen[g] } })),
  toggleOverlayGroup: (g) =>
    set((s) => ({
      overlayGroupOpen: { ...s.overlayGroupOpen, [g]: !s.overlayGroupOpen[g] },
    })),
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
