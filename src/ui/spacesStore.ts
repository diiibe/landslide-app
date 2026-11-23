import { captureAirPreferences, restoreAirPreferences } from "@/spaces/air/store";
import { selectedClasses, withClasses } from "@/lib/landslideClasses";
import { create } from "zustand";
import { z } from "zod";
import type { Map } from "maplibre-gl";
import { POI_CATEGORIES, POI_DEFAULT_COLORS } from "@/app/types";
import { useAppStore } from "@/app/store";
import { BUILTIN_LAYERS, isLayerEnabled } from "@/regional/builtins";
import { useRegionalStore } from "@/regional/store";
const KEY = "friulview:spaces:v1";
const flags = z.record(z.string().max(180), z.boolean());
const style = z.object({ scheme: z.literal("upper-quintile-v1").optional(), classes: z.array(z.number().int().min(1).max(5)).max(5).optional(), minClass: z.number().int().min(1).max(5), opacity: z.number().min(0).max(1) });
const airLayers=z.enum(["inventory","observations","stack","aia","world","industrial","commercial","corine"]);
const airDate=z.string().regex(/^(?:|\d{4}-\d{2}-\d{2})$/);
const airPreferences=z.object({layers:z.record(airLayers,z.boolean()),opacity:z.record(airLayers,z.number().finite().min(0).max(1)),questions:z.array(z.enum(["inventory","observations","landcover"])).max(3),baseline:z.partialRecord(airLayers,z.boolean()),poll:z.enum(["NOx","PM10","PM2_5"]),sector:z.enum(["industry","nonindustrial","road","all"]),measure:z.enum(["pm10","pm25","no2"]),municipalityId:z.string().max(128),stationId:z.string().max(128),compareId:z.string().max(128),date:airDate,followLatest:z.boolean(),stackDate:airDate,stackFollowLatest:z.boolean(),timeTarget:z.enum(["observations","stack"]),aiaMode:z.enum(["points","heatmap","both"]),aiaCategory:z.enum(["all","industry","farm","waste","other"]),aiaQuery:z.string().max(500),aiaMunicipality:z.string().max(256).nullable()});
const schema = z.object({
  air: airPreferences.optional(),
  experienceId: z.enum(["landslides","industry","vineyard","retail","traffic","mountain","fire","wildlife","park","trek","air"]).optional(),
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
export function captureView(name: string, experienceId?: Space["experienceId"]): Space {
  const a = useAppStore.getState(), r = useRegionalStore.getState(), m = map();
  const center = m?.getCenter();
  const enabled = { ...r.enabled };
  for (const layer of BUILTIN_LAYERS) enabled[layer.id] = isLayerEnabled(layer);
  const space = schema.parse({ ...(experienceId==="air"?{air:captureAirPreferences()}:{}), experienceId, id: crypto.randomUUID(), name, savedAt: Date.now(), layers: a.layers, floodView: a.floodView, floodOpacity: a.floodOpacity, paiOpacity: a.paiOpacity, diffOpacity: a.diffOpacity, poiColors: a.poiColors, poiCategoryVisible: a.poiCategoryVisible, enabled, opacity: r.opacity, display: r.display, susceptibilityStyle: a.susceptibilityStyle, basemap: a.basemap, view3D: a.view3D,
    camera: m && center ? { center: [center.lng, center.lat], zoom: m.getZoom(), bearing: m.getBearing(), pitch: m.getPitch() } : null });
  return space;
}
export function saveSpace(name: string, experienceId?: Space["experienceId"]) {
  publish([captureView(name, experienceId), ...useSpaces.getState().spaces].slice(0, 30));
}
export function removeSpace(id: string) { publish(useSpaces.getState().spaces.filter(s => s.id !== id)); }
export function restoreSpace(space: Space) {
  const s = schema.parse(space), a = useAppStore.getState();
  if(s.experienceId==="air"&&s.air)restoreAirPreferences(s.air);
  const layers = Object.fromEntries(Object.keys(a.layers).map(key => [key, s.layers[key] ?? false])) as typeof a.layers;
  // Preserve both current maps; only suppress incompatible legacy surfaces.
  if (layers.v2Bodies || layers.v2Diffuse) {
    layers.susceptibility = false; layers.smoothHeatmap = false;
  }
  useAppStore.setState({ layers, floodView: s.floodView, floodOpacity: s.floodOpacity, paiOpacity: s.paiOpacity, diffOpacity: s.diffOpacity, poiColors: { ...a.poiColors, ...s.poiColors }, poiCategoryVisible: { ...a.poiCategoryVisible, ...s.poiCategoryVisible }, basemap: s.basemap, view3D: s.view3D, cameraRequest: s.camera, susceptibilityStyle: { bodies: withClasses(s.susceptibilityStyle.bodies, s.susceptibilityStyle.bodies.scheme ? selectedClasses(s.susceptibilityStyle.bodies) : [1,2,3,4,5]), diffuse: withClasses(s.susceptibilityStyle.diffuse, s.susceptibilityStyle.diffuse.scheme ? selectedClasses(s.susceptibilityStyle.diffuse) : [1,2,3,4,5]) } });
  useRegionalStore.setState({ enabled: s.enabled, opacity: s.opacity, display: s.display, detailId: null, selection: null });
  try { localStorage.setItem("fvg:regional-layers:v1", JSON.stringify({ enabled: s.enabled, opacity: s.opacity, display: s.display, open: useRegionalStore.getState().open })); } catch { useSpaces.setState({ storageError: true }); }
}
