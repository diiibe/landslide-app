import { useEffect, useState } from "react";
import type { MapGeoJSONFeature } from "maplibre-gl";
import { useAppStore } from "@/app/store";
import type { Zone } from "@/app/types";
import { SUSCEPT_LAYER } from "./layers/susceptibility";
import { IFFI_FILL } from "./layers/iffi";
import { getMap, subscribeMap } from "./instance";

export interface ZoneBreakdown {
  count: number;
  aboveThr: number;
}

export interface LiveStats {
  cells_visible: number;
  cells_total: number;
  area_km2: number;
  zones_active: number;
  zones_total: number;
  iffi_polygons_in_view: number;
  iffi_cells: number;
  captured_above_threshold: number;
  hit_rate: number;
  precision: number;
  prob: { mean: number; median: number; p99: number; above_threshold_pct: number };
  histogram: number[];
  mean_by_zone: { zone: Zone; mean_p: number }[];
  iffi_by_type: { tipo: string; count: number }[];
  /** Per-zone counts: total cells visible in the zone and how many of
   *  those clear the current threshold. Used by AnalyticsPanel to render
   *  exact "% above" without going through histogram midpoints (P1.3). */
  zone_breakdown: Record<string, ZoneBreakdown>;
  /** Exact cell counts at each of the four published decision thresholds.
   *  AnalyticsPanel renders one row per threshold; histogram-midpoint
   *  approximations would misreport 0.85 by ~5pp because that threshold
   *  splits the 0.8–0.9 bin. */
  above_at: Record<string, number>;
}

const STANDARD_THRESHOLDS = [0.3, 0.5, 0.7, 0.85] as const;

const CELL_AREA_KM2 = (117 * 117) / 1_000_000; // 0.013689
const CELLS_TOTAL = 676_416;
const STARVATION_BUDGET_MS = 1500;
const DEBOUNCE_MS = 250;

function pctile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.floor(sorted.length * q));
  return sorted[i] ?? 0;
}

interface ComputeArgs {
  cellFeatures: ReadonlyArray<Pick<MapGeoJSONFeature, "properties">>;
  iffiFeatures: ReadonlyArray<Pick<MapGeoJSONFeature, "properties">>;
  threshold: number;
  selectedZones: Zone[];
}

/**
 * Pure stats computation. Extracted from the hook so it's testable without
 * a real MapLibre instance, and so we can unit-test the per-zone aboveThr
 * count that AnalyticsPanel.pctAt depends on (P1.3).
 *
 * Single pass over cellFeatures (P1.4): mean, count, histogram, hit
 * accumulation, zone breakdown, and the raw p-array (for percentiles)
 * all built in one loop. Sort happens once at the end.
 */
export function computeStats({
  cellFeatures,
  iffiFeatures,
  threshold,
  selectedZones,
}: ComputeArgs): LiveStats | null {
  const total = cellFeatures.length;
  if (total === 0) return null;

  const ps: number[] = new Array(total);
  const histogram = new Array<number>(10).fill(0);
  const zoneAgg = new Map<string, { sum: number; n: number }>();
  const zoneBreakdown = new Map<string, ZoneBreakdown>();

  let sum = 0;
  let iffiCells = 0;
  let captured = 0;
  let aboveThr = 0;
  const aboveAt: Record<string, number> = {};
  for (const t of STANDARD_THRESHOLDS) aboveAt[t.toString()] = 0;

  for (let i = 0; i < total; i++) {
    const props = (cellFeatures[i]!.properties ?? {}) as Record<string, unknown>;
    const p = Number(props.p ?? 0);
    const hit = Boolean(props.iffi_hit);
    const zone = typeof props.zone === "string" ? props.zone : undefined;
    ps[i] = p;
    sum += p;
    if (hit) iffiCells++;
    const above = p >= threshold;
    if (above) aboveThr++;
    if (above && hit) captured++;
    for (const t of STANDARD_THRESHOLDS) {
      if (p >= t) aboveAt[t.toString()] = (aboveAt[t.toString()] ?? 0) + 1;
    }
    const idx = Math.min(9, Math.max(0, Math.floor(p * 10)));
    histogram[idx]!++;
    if (zone) {
      const a = zoneAgg.get(zone) ?? { sum: 0, n: 0 };
      a.sum += p;
      a.n++;
      zoneAgg.set(zone, a);
      const b = zoneBreakdown.get(zone) ?? { count: 0, aboveThr: 0 };
      b.count++;
      if (above) b.aboveThr++;
      zoneBreakdown.set(zone, b);
    }
  }

  // Sort once, only if needed for percentiles.
  const sorted = total > 1 ? ps.slice().sort((a, b) => a - b) : ps.slice();
  const mean = sum / total;
  const median = pctile(sorted, 0.5);
  const p99 = pctile(sorted, 0.99);
  const above_threshold_pct = (aboveThr / total) * 100;
  const hit_rate = iffiCells > 0 ? captured / iffiCells : 0;
  const precision = aboveThr > 0 ? captured / aboveThr : 0;

  // IFFI aggregation — independent of cell loop.
  const seen = new Set<string>();
  const typeAgg = new Map<string, number>();
  for (const f of iffiFeatures) {
    const props = (f.properties ?? {}) as Record<string, unknown>;
    if (typeof props.id_frana === "string") seen.add(props.id_frana);
    if (typeof props.tipo_movimento === "string") {
      typeAgg.set(props.tipo_movimento, (typeAgg.get(props.tipo_movimento) ?? 0) + 1);
    }
  }

  const iffi_by_type = [...typeAgg.entries()]
    .map(([tipo, count]) => ({ tipo, count }))
    .sort((a, b) => b.count - a.count);

  const mean_by_zone = [...zoneAgg.entries()]
    .map(([zone, a]) => ({ zone: zone as Zone, mean_p: a.sum / a.n }))
    .sort((a, b) => b.mean_p - a.mean_p);

  const zone_breakdown: Record<string, ZoneBreakdown> = {};
  for (const [zone, agg] of zoneBreakdown) zone_breakdown[zone] = agg;

  return {
    cells_visible: total,
    cells_total: CELLS_TOTAL,
    area_km2: total * CELL_AREA_KM2,
    zones_active: selectedZones.length === 0 ? 5 : selectedZones.length,
    zones_total: 5,
    iffi_polygons_in_view: seen.size,
    iffi_cells: iffiCells,
    captured_above_threshold: captured,
    hit_rate,
    precision,
    prob: { mean, median, p99, above_threshold_pct },
    histogram,
    mean_by_zone,
    iffi_by_type,
    zone_breakdown,
    above_at: aboveAt,
  };
}

/**
 * Hook that subscribes to the map and recomputes per-viewport stats whenever
 * the user pans/zooms. Reads features from the actual rendered tiles via
 * `queryRenderedFeatures` — no placeholders.
 *
 * P1.4: only `moveend` + `idle` drive recompute. The previous version also
 * listened to `sourcedata`, which fires on every tile load and continuously
 * reset the 250 ms debounce — on a slow link the compute could starve
 * indefinitely. A 1.5 s watchdog forces a recompute even if events keep
 * firing back-to-back.
 */
export function useMapStats(): LiveStats | null {
  const threshold = useAppStore((s) => s.threshold);
  const model = useAppStore((s) => s.model);
  const selectedZones = useAppStore((s) => s.selectedZones);
  const [stats, setStats] = useState<LiveStats | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastComputeAt = 0;

    const compute = () => {
      lastComputeAt = Date.now();
      const map = getMap();
      if (!map || !map.getLayer(SUSCEPT_LAYER)) {
        setStats(null);
        return;
      }
      const cellFeatures = map.queryRenderedFeatures({ layers: [SUSCEPT_LAYER] });
      const iffiFeatures = map.getLayer(IFFI_FILL)
        ? map.queryRenderedFeatures({ layers: [IFFI_FILL] })
        : [];
      setStats(computeStats({ cellFeatures, iffiFeatures, threshold, selectedZones }));
    };

    const debounced = () => {
      // Watchdog: if events have been arriving for longer than the budget
      // without a recompute, force one immediately so the UI doesn't
      // starve under continuous tile loading.
      if (lastComputeAt && Date.now() - lastComputeAt > STARVATION_BUDGET_MS) {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        compute();
        return;
      }
      if (timer) clearTimeout(timer);
      timer = setTimeout(compute, DEBOUNCE_MS);
    };

    let attached = false;
    const attach = () => {
      const map = getMap();
      if (!map || attached) return;
      attached = true;
      map.on("moveend", debounced);
      map.on("idle", debounced);
      compute();
    };

    attach();
    const unsub = subscribeMap(attach);

    return () => {
      const map = getMap();
      if (map && attached) {
        map.off("moveend", debounced);
        map.off("idle", debounced);
      }
      if (timer) clearTimeout(timer);
      unsub();
    };
  }, [threshold, model, selectedZones]);

  return stats;
}
