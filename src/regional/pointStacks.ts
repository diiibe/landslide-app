import type { ExpressionSpecification, Map as MLMap, MapGeoJSONFeature, SymbolLayerSpecification } from "maplibre-gl";
import { useAppStore } from "@/app/store";
import { useTwinStore } from "@/digital-twin/store";
import { useRegionalStore } from "./store";
import { dataFeatureKey, dataLayers } from "./mapPicking";
import { readingText } from "./pointReadings";

export function groupedPointReadings(features: MapGeoJSONFeature[]) {
  const groups = new Map<string, Map<string, MapGeoJSONFeature>>();
  for (const feature of features) {
    if (feature.geometry.type !== "Point" || feature.properties?.cluster || feature.properties?.__overview) continue;
    const [x, y] = feature.geometry.coordinates;
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const position = `${x!.toFixed(7)},${y!.toFixed(7)}`;
    let group = groups.get(position);
    if (!group) groups.set(position, group = new Map());
    // Preserve rendering order: the value already on top remains the first row.
    const key = dataFeatureKey(feature);
    if (!group.has(key)) group.set(key, feature);
  }
  return new Map([...groups].filter(([, records]) => records.size > 1).map(([key, records]) => [key, [...records.values()]]));
}

/** Match domain identity, including depth, without confusing a tile's generated
 * feature.id=0 with the source's own identity. No source data is modified. */
function identity(feature: MapGeoJSONFeature): ExpressionSpecification {
  const p = feature.properties ?? {};
  const keys = p.__featureId !== undefined ? ["__featureId", "variable", "__depth"]
    : p.stationId !== undefined ? ["stationId", "variable", "__depth"]
    : Object.keys(p).sort();
  const tests: ExpressionSpecification[] = keys.flatMap(key => p[key] === undefined
    ? [["!", ["has", key]] as ExpressionSpecification]
    : p[key] === null || ["string", "number", "boolean"].includes(typeof p[key])
      ? [["==", ["get", key], p[key]] as ExpressionSpecification] : []);
  if (p.__featureId === undefined && p.stationId === undefined && feature.id !== undefined)
    tests.push(["==", ["id"], feature.id]);
  return tests.length ? ["all", ...tests] : ["==", 1, 0];
}

/** Add the other values as lines of the existing map label. No marker, card,
 * counter, button or extra interaction: MapLibre handles placement and zoom. */
export function mountPointStacks(map: MLMap) {
  type TextField = NonNullable<NonNullable<SymbolLayerSpecification["layout"]>["text-field"]>;
  const overrides = new Map<string, { base: TextField; applied: TextField }>();
  let timer: ReturnType<typeof setTimeout> | undefined, ready = false, disposed = false;
  function restore() {
    for (const [id, record] of overrides) {
      if (map.getLayer(id) && JSON.stringify(map.getLayoutProperty(id, "text-field")) === JSON.stringify(record.applied))
        map.setLayoutProperty(id, "text-field", record.base);
    }
    overrides.clear();
  }
  function sync() {
    timer = undefined;
    if (disposed || !ready) return;
    if (document.hidden || useAppStore.getState().drawingMode) { restore(); return; }
    const style = map.getStyle();
    const layers = dataLayers(map);
    const labels = style.layers.filter((l): l is SymbolLayerSpecification => l.type === "symbol" &&
      layers.includes(l.id) && !!l.layout?.["text-field"] &&
      l.layout["visibility"] !== "none" && (l.minzoom ?? 0) <= map.getZoom() && (l.maxzoom ?? 24) > map.getZoom());
    const visible = layers.length ? map.queryRenderedFeatures({ layers }).filter(f => {
      if (f.geometry.type !== "Point" || !(typeof f.properties.value === "number" || typeof f.properties.__value === "number" || f.properties.__displayValue !== undefined)) return false;
      const id = f.source.startsWith("regional-") ? f.source.slice(9) : f.source.startsWith("twin-sensors") ? "pcr-" + String(f.properties.variable) : null;
      if (id && useRegionalStore.getState().opacity[id] === 0) return false;
      // Circles retain the complete identity even when their own text is hidden
      // by this module. This avoids a hide/query/show feedback loop.
      if (f.layer.type === "circle") return map.getPaintProperty(f.layer.id, "circle-opacity") !== 0;
      return f.layer.type === "symbol" && !!f.layer.layout?.["icon-image"] && map.getPaintProperty(f.layer.id, "icon-opacity") !== 0;
    }) : [];
    const rules = new Map<string, { condition: ExpressionSpecification; text: string }[]>();
    for (const records of groupedPointReadings(visible).values()) {
      const eligible = records.filter(f => labels.some(l => l.source === f.source && l["source-layer"] === f.sourceLayer && map.getPaintProperty(l.id, "text-opacity") !== 0));
      if (eligible.length < 2) continue;
      const text = eligible.map(f => {
        const value = f.source.startsWith("regional-") && f.properties.__mapLabel !== undefined
          ? `${String(f.properties.__mapLabel)} ${String(f.properties.__unit ?? useRegionalStore.getState().catalog?.layers.find(l => "regional-" + l.id === f.source)?.metric?.unit ?? "")}`.trim()
          : readingText(f).value;
        const depth = f.properties.__depth;
        return depth === undefined || depth === null || depth === "" ? value : `${value} · ${depth} m`;
      }).join("\n");
      let owner = false;
      for (const f of eligible) for (const layer of labels) {
        if (layer.source !== f.source || layer["source-layer"] !== f.sourceLayer) continue;
        let list = rules.get(layer.id);
        if (!list) rules.set(layer.id, list = []);
        list.push({ condition: identity(f), text: owner ? "" : text });
        owner = true;
      }
    }
    for (const [id, record] of overrides) if (!rules.has(id)) {
      if (map.getLayer(id) && JSON.stringify(map.getLayoutProperty(id, "text-field")) === JSON.stringify(record.applied))
        map.setLayoutProperty(id, "text-field", record.base);
      overrides.delete(id);
    }
    for (const [id, list] of rules) {
      const current = map.getLayoutProperty(id, "text-field") as TextField;
      const previous = overrides.get(id);
      // Adopt a new expression if the owning runtime refreshed its layout.
      const base = previous && JSON.stringify(current) === JSON.stringify(previous.applied) ? previous.base : current;
      const applied = ["case", ...list.flatMap(rule => [rule.condition, rule.text]), base] as ExpressionSpecification;
      if (JSON.stringify(current) !== JSON.stringify(applied)) map.setLayoutProperty(id, "text-field", applied);
      overrides.set(id, { base, applied });
    }
  }
  function schedule() { if (timer === undefined && !disposed) timer = setTimeout(sync, 180); }
  const loaded = () => { ready = true; schedule(); };
  const loading = () => { ready = false; overrides.clear(); };
  const visibility = () => { if (document.hidden) restore(); else schedule(); };
  const sourced = (event?: { sourceId?: string }) => {
    if (!event?.sourceId || /^(regional-|twin-sensors)/.test(event.sourceId)) schedule();
  };
  map.on("style.load", loaded); map.on("styledataloading", loading); map.on("sourcedata", sourced);
  for (const event of ["moveend", "resize"] as const) map.on(event, schedule);
  document.addEventListener("visibilitychange", visibility);
  const stops = [
    useAppStore.subscribe((s, p) => { if (s.drawingMode) restore(); if (s.layers !== p.layers || s.drawingMode !== p.drawingMode) schedule(); }),
    useTwinStore.subscribe((s, p) => { if (s.measures !== p.measures || s.active !== p.active) schedule(); }),
    useRegionalStore.subscribe((s, p) => { if (s.enabled !== p.enabled || s.entries !== p.entries || s.filters !== p.filters || s.opacity !== p.opacity) schedule(); }),
  ];
  return () => {
    disposed = true; clearTimeout(timer); restore(); stops.forEach(stop => stop());
    map.off("style.load", loaded); map.off("styledataloading", loading); map.off("sourcedata", sourced);
    for (const event of ["moveend", "resize"] as const) map.off(event, schedule);
    document.removeEventListener("visibilitychange", visibility);
  };
}
