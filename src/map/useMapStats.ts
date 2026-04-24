import { useEffect, useState } from "react";
import { useAppStore } from "@/app/store";
import type { Zone } from "@/app/types";
import { SUSCEPT_LAYER } from "./layers/susceptibility";
import { IFFI_FILL } from "./layers/iffi";
import { getMap, subscribeMap } from "./instance";

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
}

const CELL_AREA_KM2 = (117 * 117) / 1_000_000; // 0.013689
const CELLS_TOTAL = 676_416;

function pctile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.floor(sorted.length * q));
  return sorted[i] ?? 0;
}

/**
 * Hook that subscribes to the map and recomputes per-viewport stats whenever
 * the user pans/zooms or the threshold/model changes. Reads features from the
 * actual rendered tiles via `queryRenderedFeatures` — no placeholders.
 */
export function useMapStats(): LiveStats | null {
  const threshold = useAppStore((s) => s.threshold);
  const model = useAppStore((s) => s.model);
  const selectedZones = useAppStore((s) => s.selectedZones);
  const [stats, setStats] = useState<LiveStats | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const compute = () => {
      const map = getMap();
      if (!map || !map.getLayer(SUSCEPT_LAYER)) {
        setStats(null);
        return;
      }
      const cellFeatures = map.queryRenderedFeatures({ layers: [SUSCEPT_LAYER] });
      const iffiFeatures = map.getLayer(IFFI_FILL)
        ? map.queryRenderedFeatures({ layers: [IFFI_FILL] })
        : [];

      const total = cellFeatures.length;
      if (total === 0) {
        setStats(null);
        return;
      }

      const ps: number[] = [];
      let iffiCells = 0;
      let captured = 0;
      const histogram = new Array<number>(10).fill(0);
      const zoneAgg = new Map<string, { sum: number; n: number }>();
      for (const f of cellFeatures) {
        const props = f.properties ?? {};
        const p = Number((props as Record<string, unknown>).p ?? 0);
        const hit = Boolean((props as Record<string, unknown>).iffi_hit);
        const zone = (props as Record<string, unknown>).zone as string | undefined;
        ps.push(p);
        if (hit) iffiCells++;
        if (hit && p >= threshold) captured++;
        const idx = Math.min(9, Math.max(0, Math.floor(p * 10)));
        histogram[idx]!++;
        if (zone) {
          const a = zoneAgg.get(zone) ?? { sum: 0, n: 0 };
          a.sum += p;
          a.n++;
          zoneAgg.set(zone, a);
        }
      }
      const sorted = [...ps].sort((a, b) => a - b);
      const mean = ps.reduce((s, x) => s + x, 0) / total;
      const median = pctile(sorted, 0.5);
      const p99 = pctile(sorted, 0.99);
      const aboveThr = ps.reduce((n, p) => (p >= threshold ? n + 1 : n), 0);
      const above_threshold_pct = (aboveThr / total) * 100;
      const hit_rate = iffiCells > 0 ? captured / iffiCells : 0;
      const precision = aboveThr > 0 ? captured / aboveThr : 0;

      const seen = new Set<string>();
      for (const f of iffiFeatures) {
        const id = (f.properties as Record<string, unknown>)?.id_frana;
        if (typeof id === "string") seen.add(id);
      }
      const iffi_polygons_in_view = seen.size;

      const typeAgg = new Map<string, number>();
      for (const f of iffiFeatures) {
        const t = (f.properties as Record<string, unknown>)?.tipo_movimento;
        if (typeof t === "string") typeAgg.set(t, (typeAgg.get(t) ?? 0) + 1);
      }
      const iffi_by_type = [...typeAgg.entries()]
        .map(([tipo, count]) => ({ tipo, count }))
        .sort((a, b) => b.count - a.count);

      const mean_by_zone = [...zoneAgg.entries()]
        .map(([zone, a]) => ({ zone: zone as Zone, mean_p: a.sum / a.n }))
        .sort((a, b) => b.mean_p - a.mean_p);

      setStats({
        cells_visible: total,
        cells_total: CELLS_TOTAL,
        area_km2: total * CELL_AREA_KM2,
        zones_active: selectedZones.length === 0 ? 5 : selectedZones.length,
        zones_total: 5,
        iffi_polygons_in_view,
        iffi_cells: iffiCells,
        captured_above_threshold: captured,
        hit_rate,
        precision,
        prob: { mean, median, p99, above_threshold_pct },
        histogram,
        mean_by_zone,
        iffi_by_type,
      });
    };

    const debounced = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(compute, 250);
    };

    let attached = false;
    const attach = () => {
      const map = getMap();
      if (!map || attached) return;
      attached = true;
      map.on("moveend", debounced);
      map.on("idle", debounced);
      map.on("sourcedata", debounced);
      compute();
    };

    attach();
    const unsub = subscribeMap(attach);

    return () => {
      const map = getMap();
      if (map && attached) {
        map.off("moveend", debounced);
        map.off("idle", debounced);
        map.off("sourcedata", debounced);
      }
      if (timer) clearTimeout(timer);
      unsub();
    };
  }, [threshold, model, selectedZones]);

  return stats;
}
