import { create } from "zustand";
import { useAppStore } from "@/app/store";
import { useExperienceStore } from "../store";
import { QUESTIONS, observationDates } from "./model";
import type {
  AirContext,
  AirData,
  AirLayer,
  AirQuestion,
  AirView,
  AiaCategory,
  Measure,
  Pollutant,
  Sector,
  SoilReading,
  WorldCover,
  ZoneFeature,
} from "./types";
export const INITIAL_OPACITY: Record<AirLayer, number> = {
  corine: 0.55,
  inventory: 0.57,
  observations: 1,
  stack: 1,
  aia: 1,
  world: 0.55,
  industrial: 0.35,
  commercial: 0.35,
};
export interface AirState {
  data: AirData | null;
  context: AirContext | null;
  world: WorldCover | null;
  loading: boolean;
  error: string | null;
  contextError: string | null;
  worldError: string | null;
  worldTileError: string | null;
  refreshKey: number;
  layers: Record<AirLayer, boolean>;
  opacity: Record<AirLayer, number>;
  questions: AirQuestion[];
  baseline: Partial<Record<AirLayer, boolean>>;
  controls: { key: AirLayer; question: AirQuestion | null } | null;
  inspector: { view: AirView; tool: boolean; layer: AirLayer } | null;
  focusRequest: number;
  poll: Pollutant;
  sector: Sector;
  measure: Measure;
  municipalityId: string;
  stationId: string;
  compareId: string;
  date: string;
  followLatest: boolean;
  stackDate: string;
  stackFollowLatest: boolean;
  timeTarget: "observations" | "stack";
  aiaMode: "points" | "heatmap" | "both";
  aiaCategory: AiaCategory;
  aiaQuery: string;
  aiaMunicipality: string | null;
  aiaId: string | null;
  zone: ZoneFeature | null;
  soil: SoilReading | null;
}
export const useAirStore = create<AirState>(() => ({
  data: null,
  context: null,
  world: null,
  loading: false,
  error: null,
  contextError: null,
  worldError: null,
  worldTileError: null,
  refreshKey: 0,
  layers: {
    corine: false,
    inventory: true,
    observations: false,
    stack: false,
    aia: false,
    world: false,
    industrial: false,
    commercial: false,
  },
  opacity: { ...INITIAL_OPACITY },
  questions: [],
  baseline: {},
  controls: null,
  inspector: null,
  focusRequest: 0,
  poll: "NOx",
  sector: "industry",
  measure: "pm10",
  municipalityId: "93033",
  stationId: "",
  compareId: "",
  date: "",
  followLatest: true,
  stackDate: "",
  stackFollowLatest: true,
  timeTarget: "observations",
  aiaMode: "points",
  aiaCategory: "all",
  aiaQuery: "",
  aiaMunicipality: null,
  aiaId: null,
  zone: null,
  soil: null,
}));
const mobile = () => window.matchMedia?.("(max-width:1000px)").matches ?? false;
export function closeAirControls(focus = true) {
  useAirStore.setState({ controls: null });
  if (focus)
    document.getElementById("layers-trigger")?.focus({ preventScroll: true });
}
export function openAirControls(
  key: AirLayer,
  question: AirQuestion | null = null,
) {
  useAirStore.setState((s) => ({
    controls: { key, question },
    inspector: null,
    focusRequest: s.focusRequest + 1,
    ...(key === "observations" || key === "stack" ? { timeTarget: key } : {}),
  }));
  useExperienceStore.setState({ tab: "layers" });
  if (mobile()) useAppStore.setState({ drawerOpen: false });
}
function reconcile(
  next: Pick<
    AirState,
    "layers" | "opacity" | "questions" | "baseline" | "controls"
  >,
) {
  next.questions = next.questions.filter((q) =>
    QUESTIONS[q].layers.some((k) => next.layers[k] && next.opacity[k] > 0),
  );
  const claimed = new Set(next.questions.flatMap((q) => QUESTIONS[q].layers));
  next.baseline = Object.fromEntries(
    Object.entries(next.baseline).filter(
      ([k]) =>
        claimed.has(k as AirLayer) ||
        (k === "corine" && next.questions.length > 0),
    ),
  );
  if (
    next.controls?.question &&
    !next.questions.includes(next.controls.question)
  )
    next.controls = null;
  return next;
}
export function setAirLayer(key: AirLayer, on: boolean) {
  useAirStore.setState((s) => {
    const baseline = { ...s.baseline };
    if (key in baseline) baseline[key] = on;
    const layers = { ...s.layers, [key]: on };
    if (key === "world" && on) {
      layers.corine = false;
      if ("corine" in baseline) baseline.corine = false;
    }
    if (key === "corine" && on) {
      layers.world = false;
      if ("world" in baseline) baseline.world = false;
    }
    return {
      ...reconcile({
        layers,
        opacity: s.opacity,
        questions: [...s.questions],
        baseline,
        controls:
          s.controls?.key === key && !s.controls.question && !on
            ? null
            : s.controls,
      }),
      ...(on && (key === "observations" || key === "stack")
        ? { timeTarget: key }
        : {}),
    };
  });
}
export function setAirOpacity(key: AirLayer, value: number) {
  if (!Number.isFinite(value)) return;
  useAirStore.setState((s) =>
    reconcile({
      layers: s.layers,
      opacity: { ...s.opacity, [key]: Math.max(0, Math.min(1, value)) },
      questions: [...s.questions],
      baseline: { ...s.baseline },
      controls: s.controls,
    }),
  );
}
export function toggleAirQuestion(q: AirQuestion) {
  const s = useAirStore.getState(),
    keys = QUESTIONS[q].layers,
    layers = { ...s.layers },
    opacity = { ...s.opacity },
    baseline = { ...s.baseline };
  let questions = [...s.questions];
  if (questions.includes(q)) {
    questions = questions.filter((v) => v !== q);
    for (const k of keys)
      if (!questions.some((v) => QUESTIONS[v].layers.includes(k))) {
        layers[k] = baseline[k] ?? layers[k];
        delete baseline[k];
      }
    if (!questions.length && baseline.corine !== undefined) {
      layers.corine = baseline.corine;
      if (layers.corine) layers.world = false;
      delete baseline.corine;
    }
    useAirStore.setState(
      reconcile({
        layers,
        opacity,
        baseline,
        questions,
        controls: s.controls?.question === q ? null : s.controls,
      }),
    );
    return;
  }
  if (!questions.length) baseline.corine = layers.corine;
  layers.corine = false;
  for (const k of keys) {
    if (!(k in baseline)) baseline[k] = layers[k] && opacity[k] > 0;
    layers[k] = true;
    if (opacity[k] <= 0) opacity[k] = INITIAL_OPACITY[k];
  }
  questions.push(q);
  useAirStore.setState({ layers, opacity, baseline, questions });
  openAirControls(q === "landcover" ? "world" : q, q);
}
export function inspectAir(
  view: AirView,
  tool = false,
  layer: AirLayer = view === "landcover" ? "world" : view,
) {
  closeAirControls(false);
  useAirStore.setState({ inspector: { view, tool, layer } });
  useExperienceStore.setState({ tab: tool ? "tools" : "layers" });
  useAppStore.setState({ drawerOpen: true });
}
export function selectAir(
  view: AirView,
  selection: Partial<
    Pick<AirState, "stationId" | "municipalityId" | "aiaId" | "zone" | "soil">
  >,
  layer?: AirLayer,
) {
  const s = useAirStore.getState();
  useAirStore.setState(selection);
  if (s.controls) {
    openAirControls(
      layer ?? (view === "landcover" ? "world" : view),
      s.controls.question === view ? view : null,
    );
  } else
    inspectAir(
      view,
      s.inspector?.tool ?? false,
      layer ?? (view === "landcover" ? "world" : view),
    );
}
export function adoptAirData(data: AirData) {
  useAirStore.setState((s) => {
    const dates = observationDates(data),
      last = dates.at(-1) ?? "",
      stackLast =
        data.sme
          .filter((r) => r.NOx !== null || r.dust !== null || r.SO2 !== null)
          .at(-1)?.date ??
        data.sme.at(-1)?.date ??
        "",
      station =
        data.stations.find((v) => v.id === s.stationId) ??
        data.stations.find((v) => /marconi/i.test(v.name)) ??
        data.stations[0],
      comparison =
        data.stations.find((v) => v.id === s.compareId) ??
        data.stations.find((v) => v.id !== station?.id);
    return {
      data,
      loading: false,
      error: null,
      stationId: station?.id ?? "",
      compareId: comparison?.id ?? station?.id ?? "",
      date: s.followLatest || !s.date ? last : s.date,
      stackDate: s.stackFollowLatest || !s.stackDate ? stackLast : s.stackDate,
    };
  });
}
export function setAirDate(target: "observations" | "stack", date: string) {
  useAirStore.setState(
    target === "observations"
      ? { date, followLatest: false, timeTarget: target }
      : { stackDate: date, stackFollowLatest: false, timeTarget: target },
  );
}
export function airFocus(coordinates: [number, number], zoom = 11) {
  useAppStore.setState({
    cameraRequest: {
      center: coordinates,
      zoom,
      bearing: 0,
      pitch: useAppStore.getState().view3D ? 45 : 0,
    },
  });
}

export type AirPreferences = Pick<
  AirState,
  | "layers"
  | "opacity"
  | "questions"
  | "baseline"
  | "poll"
  | "sector"
  | "measure"
  | "municipalityId"
  | "stationId"
  | "compareId"
  | "date"
  | "followLatest"
  | "stackDate"
  | "stackFollowLatest"
  | "timeTarget"
  | "aiaMode"
  | "aiaCategory"
  | "aiaQuery"
  | "aiaMunicipality"
>;
export function captureAirPreferences(): AirPreferences {
  const s = useAirStore.getState();
  return {
    layers: { ...s.layers },
    opacity: { ...s.opacity },
    questions: [...s.questions],
    baseline: { ...s.baseline },
    poll: s.poll,
    sector: s.sector,
    measure: s.measure,
    municipalityId: s.municipalityId,
    stationId: s.stationId,
    compareId: s.compareId,
    date: s.date,
    followLatest: s.followLatest,
    stackDate: s.stackDate,
    stackFollowLatest: s.stackFollowLatest,
    timeTarget: s.timeTarget,
    aiaMode: s.aiaMode,
    aiaCategory: s.aiaCategory,
    aiaQuery: s.aiaQuery,
    aiaMunicipality: s.aiaMunicipality,
  };
}
export function restoreAirPreferences(preferences: AirPreferences) {
  useAirStore.setState({
    ...preferences,
    ...reconcile({ ...preferences, controls: null }),
    inspector: null,
    zone: null,
    soil: null,
  });
}
