import { create } from "zustand";
import type { Review } from "./wildlife";
export type TreeFeature = GeoJSON.Feature<
  GeoJSON.Point,
  Record<string, unknown>
>;
interface State {
  coincidentIds: string[];
  fireDay: number;
  firePlaying: boolean;
  showPerimeters: boolean;
  showAir: boolean;
  fireData: GeoJSON.FeatureCollection | null;
  fireError: string | null;
  trees: TreeFeature[];
  treeError: string | null;
  treeLoading: boolean;
  treeRetrieved: string | null;
  treeInputRows: number;
  treeQuery: string;
  family: string;
  treeMode: "family" | "condition";
  plan: string[];
  inspections: Record<string, { at: number; note: string }>;
  minutes: number;
  threshold: number;
  camera: string;
  species: string;
  reviews: Record<string, Review>;
  captureId: string | null;
}
export const useNatureStore = create<State>(() => ({
  coincidentIds: [],
  fireDay: 0,
  firePlaying: false,
  showPerimeters: true,
  showAir: true,
  fireData: null,
  fireError: null,
  trees: [],
  treeError: null,
  treeLoading: false,
  treeRetrieved: null,
  treeInputRows: 1242,
  treeQuery: "",
  family: "all",
  treeMode: "family",
  plan: [],
  inspections: {},
  minutes: 8,
  threshold: 0.8,
  camera: "all",
  species: "all",
  reviews: {},
  captureId: null,
}));
export function treeId(f: TreeFeature) {
  return String(f.properties.__featureId ?? f.id ?? f.properties.prog);
}
export function treeMatches(
  f: TreeFeature,
  s: Pick<State, "treeQuery" | "family">,
) {
  return (
    (s.family === "all" || String(f.properties.familia) === s.family) &&
    `${f.properties.prog ?? ""} ${f.properties.specie ?? ""} ${f.properties.familia ?? ""} ${f.properties.dove ?? ""}`
      .toLocaleLowerCase("it")
      .includes(s.treeQuery.toLocaleLowerCase("it").trim())
  );
}
export const FAMILY_COLORS = [
  "#83b990",
  "#d5b476",
  "#8fb8cc",
  "#ce9a99",
  "#a9a3cb",
  "#b8c97e",
];
export function treeFamilyColor(f: Pick<TreeFeature, "properties">) {
  const x = String(f.properties.familia ?? "Non indicata");
  let h = 0;
  for (const c of x) h += c.charCodeAt(0);
  return FAMILY_COLORS[h % FAMILY_COLORS.length]!;
}
export function addToPlan(id: string) {
  useNatureStore.setState((s) => ({
    plan: s.plan.includes(id)
      ? s.plan.filter((p) => p !== id)
      : [...s.plan, id],
  }));
}
