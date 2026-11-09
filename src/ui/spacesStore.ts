import { create } from "zustand";
import { z } from "zod";
import type { Map } from "maplibre-gl";
import { POI_CATEGORIES, POI_DEFAULT_COLORS } from "@/app/types";
import { useAppStore } from "@/app/store";
import { BUILTIN_LAYERS, isLayerEnabled } from "@/regional/builtins";
import { useRegionalStore } from "@/regional/store";
const KEY = "friulview:spaces:v1";
const flags = z.record(z.string().max(180), z.boolean());
const style = z.object({ minClass: z.number().int().min(1).max(5), opacity: z.number().min(0).max(1) });
const schema = z.object({
  id: z.string().max(100), name: z.string().trim().min(1).max(70), savedAt: z.number().finite(),
  layers: flags, enabled: flags,
  opacity: z.record(z.string(), z.number().min(0).max(1)),
  display: z.record(z.string(), z.enum(["auto", "points", "density"])),
  susceptibilityStyle: z.object({ bodies: style, diffuse: style }),
  basemap: z.enum(["outdoors", "light", "satellite", "dark"]), view3D: z.boolean(),
  floodView: z.enum(["combined", "P3", "P2plus", "P1plus"]).default("combined"),
  floodOpacity: z.number().min(0).max(1).default(0.85),
  paiOpacity: z.number().min(0).max(1).default(0.85),
  diffOpacity: z.number().min(0).max(1).default(0.9),
  poiColors: z.record(z.string(), z.string().regex(/^#[0-9a-f]{6}$/i)).default(() => ({ ...POI_DEFAULT_COLORS })),
  poiCategoryVisible: flags.default(() => Object.fromEntries(POI_CATEGORIES.map(c => [c, true]))),
  camera: z.object({ center: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]), zoom: z.number().min(0).max(24), bearing: z.number().finite(), pitch: z.number().min(0).max(85) }).nullable(),
});
export type Space = z.infer<typeof schema>;
function initial(): Space[] {
  try { const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]"); return Array.isArray(raw) ? raw.slice(0, 30).flatMap(v => { const p = schema.safeParse(v); return p.success ? [p.data] : []; }) : []; } catch { return []; }
}
export const useSpaces = create<{ spaces: Space[]; storageError: boolean }>(() => ({ spaces: initial(), storageError: false }));
function publish(spaces: Space[]) {
  let storageError = false;
  try { localStorage.setItem(KEY, JSON.stringify(spaces)); } catch { storageError = true; }
  useSpaces.setState({ spaces, storageError });
}
const map = () => (window as unknown as { __mlmap?: Map }).__mlmap;
export function saveSpace(name: string) {
  const a = useAppStore.getState(), r = useRegionalStore.getState(), m = map();
  const center = m?.getCenter();
  const enabled = { ...r.enabled };
  for (const layer of BUILTIN_LAYERS) enabled[layer.id] = isLayerEnabled(layer);
  const space = schema.parse({ id: crypto.randomUUID(), name, savedAt: Date.now(), layers: a.layers, floodView: a.floodView, floodOpacity: a.floodOpacity, paiOpacity: a.paiOpacity, diffOpacity: a.diffOpacity, poiColors: a.poiColors, poiCategoryVisible: a.poiCategoryVisible, enabled, opacity: r.opacity, display: r.display, susceptibilityStyle: a.susceptibilityStyle, basemap: a.basemap, view3D: a.view3D,
    camera: m && center ? { center: [center.lng, center.lat], zoom: m.getZoom(), bearing: m.getBearing(), pitch: m.getPitch() } : null });
  publish([space, ...useSpaces.getState().spaces].slice(0, 30));
}
export function removeSpace(id: string) { publish(useSpaces.getState().spaces.filter(s => s.id !== id)); }
export function restoreSpace(space: Space) {
  const s = schema.parse(space), a = useAppStore.getState();
  const layers = Object.fromEntries(Object.keys(a.layers).map(key => [key, s.layers[key] ?? false])) as typeof a.layers;
  // Honour the same mutually exclusive susceptibility surfaces as the layer picker.
  if (layers.v2Bodies || layers.v2Diffuse) {
    if (layers.v2Bodies) layers.v2Diffuse = false;
    layers.susceptibility = false; layers.smoothHeatmap = false;
  }
  useAppStore.setState({ layers, floodView: s.floodView, floodOpacity: s.floodOpacity, paiOpacity: s.paiOpacity, diffOpacity: s.diffOpacity, poiColors: { ...a.poiColors, ...s.poiColors }, poiCategoryVisible: { ...a.poiCategoryVisible, ...s.poiCategoryVisible }, basemap: s.basemap, view3D: s.view3D, cameraRequest: s.camera, susceptibilityStyle: s.susceptibilityStyle });
  useRegionalStore.setState({ enabled: s.enabled, opacity: s.opacity, display: s.display, detailId: null, selection: null });
  try { localStorage.setItem("fvg:regional-layers:v1", JSON.stringify({ enabled: s.enabled, opacity: s.opacity, display: s.display, open: useRegionalStore.getState().open })); } catch { useSpaces.setState({ storageError: true }); }
}
