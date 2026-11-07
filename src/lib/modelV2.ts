import { useEffect, useState } from "react";
import { ModelV2FileSchema, parseOrThrow, type ModelV2File } from "./schemas";

/**
 * Loader for `public/data/model_v2.json` (written by `make tiles-v2`).
 *
 * The file only exists once the HazardFVG export has been baked, so a
 * missing or malformed file is an expected state, not a crash: the UI
 * reads `status === "missing"` and keeps the v2 toggles disabled. One
 * shared promise serves the LayersPanel, the legend and the drawer.
 */
export type ModelV2State =
  | { status: "loading"; data: null }
  | { status: "ready"; data: ModelV2File }
  | { status: "missing"; data: null };

let cached: Promise<ModelV2File | null> | null = null;

export function loadModelV2(): Promise<ModelV2File | null> {
  cached ??= fetch(`${import.meta.env.BASE_URL}data/model_v2.json`)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .then((d: unknown) => parseOrThrow(ModelV2FileSchema, d, "model_v2.json"))
    .catch((err: unknown) => {
      console.info("[model v2] data not available:", err);
      return null;
    });
  return cached;
}

/** Test hook: forget the cached fetch so each test can stub its own. */
export function resetModelV2Cache(): void {
  cached = null;
}

export function useModelV2(): ModelV2State {
  const [state, setState] = useState<ModelV2State>({ status: "loading", data: null });
  useEffect(() => {
    let cancelled = false;
    void loadModelV2().then((data) => {
      if (cancelled) return;
      setState(data ? { status: "ready", data } : { status: "missing", data: null });
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}
