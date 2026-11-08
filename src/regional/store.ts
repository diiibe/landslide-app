import { create } from "zustand";
import { FOLDERS } from "./types";
import type {
  LayerDefinition,
  LayerEntry,
  MapSelection,
  RegionalCatalog,
} from "./types";
const KEY = "fvg:regional-layers:v1";
function saved(): {
  enabled: Record<string, boolean>;
  opacity: Record<string, number>;
  open: Record<string, boolean>;
} {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "{}");
    return {
      enabled: v.enabled && typeof v.enabled === "object" ? v.enabled : {},
      opacity: v.opacity && typeof v.opacity === "object" ? v.opacity : {},
      open: v.open && typeof v.open === "object" ? v.open : {},
    };
  } catch {
    return { enabled: {}, opacity: {}, open: {} };
  }
}
const initial = saved();
interface RegionalState {
  catalog: RegionalCatalog | null;
  catalogError: string | null;
  enabled: Record<string, boolean>;
  opacity: Record<string, number>;
  open: Record<string, boolean>;
  entries: Record<string, LayerEntry>;
  selection: MapSelection | null;
  detailId: string | null;
  filters: Record<string, string>;
  tab: "layers" | "analysis";
  query: string;
  activeOnly: boolean;
  refreshKey: number;
}
export const useRegionalStore = create<RegionalState>(() => ({
  catalog: null,
  catalogError: null,
  ...initial,
  entries: {},
  selection: null,
  detailId: null,
  filters: {},
  tab: "layers",
  query: "",
  activeOnly: false,
  refreshKey: 0,
}));
function persist() {
  const { enabled, opacity, open } = useRegionalStore.getState();
  try {
    localStorage.setItem(KEY, JSON.stringify({ enabled, opacity, open }));
  } catch {
    /* Map stays usable when storage is disabled. */
  }
}
export function setRegionalEnabled(id: string, on: boolean) {
  useRegionalStore.setState((s) => ({ enabled: { ...s.enabled, [id]: on } }));
  persist();
}
export function setRegionalOpacity(id: string, value: number) {
  if (!Number.isFinite(value)) return;
  useRegionalStore.setState((s) => ({
    opacity: { ...s.opacity, [id]: Math.max(0, Math.min(1, value)) },
  }));
  persist();
}
export function toggleFolder(id: string) {
  useRegionalStore.setState((s) => ({
    open: { ...s.open, [id]: !s.open[id] },
  }));
  persist();
}
export function patchEntry(id: string, patch: Partial<LayerEntry>) {
  useRegionalStore.setState((s) => ({
    entries: {
      ...s.entries,
      [id]: {
        loading: false,
        error: null,
        snapshot: false,
        ...s.entries[id],
        ...patch,
      },
    },
  }));
}
export const layerURL = (file: string) =>
  new URL(
    `${import.meta.env.BASE_URL}data/regional/${file}`,
    window.location.href,
  ).href;
export function parseCatalog(raw: unknown): RegionalCatalog {
  if (
    !raw ||
    typeof raw !== "object" ||
    !("layers" in raw) ||
    !Array.isArray(raw.layers)
  )
    throw Error("Catalogo dei livelli non valido");
  const c = raw as RegionalCatalog;
  if (!Number.isFinite(Date.parse(c.generatedAt)))
    throw Error("Data catalogo non valida");
  const ids = new Set<string>();
  for (const l of c.layers) {
    if (
      !l ||
      typeof l.id !== "string" ||
      !/^[-a-z0-9]+$/.test(l.id) ||
      ids.has(l.id) ||
      typeof l.title !== "string" ||
      !(l.folder in FOLDERS) ||
      !["ready", "blocked"].includes(l.status)
    )
      throw Error("Definizione di livello non valida");
    if (l.file && !/^[-a-z0-9]+\.(geojson|pmtiles)$/.test(l.file))
      throw Error("Percorso dati non valido");
    ids.add(l.id);
  }
  return c;
}
export function definition(id: string): LayerDefinition | undefined {
  return useRegionalStore.getState().catalog?.layers.find((l) => l.id === id);
}
