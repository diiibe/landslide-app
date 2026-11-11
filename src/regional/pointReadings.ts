import { metricTone } from "./mapStyle";
import { Popup, type Map as MLMap, type MapGeoJSONFeature, type MapMouseEvent, type GeoJSONSource } from "maplibre-gl";
import { useAppearance } from "@/ui/appearance";
import { useAppStore } from "@/app/store";
import { sensorTone, VARIABLES, formatTime, formatValue, type Variable } from "@/digital-twin/data";
import { useTwinStore } from "@/digital-twin/store";
import { selectObject, useExperienceStore } from "@/spaces/store";
import { isProbeClick } from "@/spaces/interactions";
import { dataFeatureKey, pickDataFeatures } from "./mapPicking";
import { useRegionalStore } from "./store";
import styles from "./PointReadings.module.css";

const consumed = new WeakSet<object>();
const openMaps = new WeakSet<MLMap>();
export const isPointReadingClick = (event: MapMouseEvent) => consumed.has(event.originalEvent ?? event);
export const hasPointReadings = (map: MLMap) => openMaps.has(map);

export function readingLayer(feature: MapGeoJSONFeature) {
  return useRegionalStore.getState().catalog?.layers.find(l =>
    feature.source ? feature.source === "regional-" + l.id : feature.layer.id.startsWith("regional-" + l.id + "-"));
}
export function readingText(feature: MapGeoJSONFeature) {
  const p = feature.properties ?? {}, layer = readingLayer(feature);
  if (feature.source === "trek-nodes") return {title:String(p.name??"Segnavia SmartTrek"),value:String(p.readingValue??""),detail:String(p.readingDetail??"Demo simulata"),color:String(p.color??"#86b79b")};
  if (feature.source === "nature-nodes") return {title:String(p.name??"Dato dello Spazio"),value:p.natureSpace==="park"?"Censimento storico ERPAC":String(p.label??""),detail:String(p.readingDetail??""),color:String(p.color??"#83b990")};
  const variable = typeof p.variable === "string" && p.variable in VARIABLES ? p.variable as Variable : null;
  const title = variable ? VARIABLES[variable].label : layer?.title ?? (feature.layer.id === "twin-aia" ? "Attività autorizzata AIA" : "Dato territoriale");
  const unit = String(p.__unit ?? layer?.metric?.unit ?? "");
  const value = variable ? String(p.label ?? `${formatValue(Number(p.value))} ${VARIABLES[variable].unit}`)
    : p.__displayValue !== undefined ? `${String(p.__displayValue)} ${unit}`.trim()
    : typeof p.__value === "number" ? `${formatValue(p.__value)} ${unit}`.trim() : "";
  const time = p.__observedAt ? formatTime(Date.parse(String(p.__observedAt))) : p.observedAt;
  const entry = layer && useRegionalStore.getState().entries[layer.id];
  const feed = variable ? useTwinStore.getState().sensorsFeed : null;
  const detail = [
    String(p.__name ?? p.name ?? p.ragione_sociale ?? ""),
    p.__depth !== undefined && p.__depth !== null && p.__depth !== "" ? `Profondità ${String(p.__depth)} m` : "",
    time, p.freshness,
    p.qualita ? `Qualità: ${String(p.qualita)}` : "",
    p.__censored ? "Valore censurato" : "",
    entry?.error || feed?.error ? "Aggiornamento non riuscito" : entry?.snapshot || feed?.snapshot ? "Copia salvata" : "",
  ].filter(Boolean).join(" · ");
  return { title, value, detail, color: variable ? sensorTone(Number(p.value),variable,p.stale===true) : layer ? metricTone(layer,p,entry?.data) : "#b68c4c" };
}
export function selectPointReading(feature: MapGeoJSONFeature) {
  const p = feature.properties ?? {}, layer = readingLayer(feature);
  if (feature.source === "trek-nodes" || feature.source === "nature-nodes") { selectObject(String(p.id??feature.id)); return; }
  if (useExperienceStore.getState().activeId) useExperienceStore.setState({tab:"layers"});
  if (layer) {
    useTwinStore.setState({ selection: null });
    useRegionalStore.setState({ selection: { layerId: layer.id, feature: { type: "Feature", geometry: feature.geometry, properties: { ...p }, ...(feature.id !== undefined ? { id: feature.id } : {}) } }, detailId: layer.id, tab: "layers" });
  } else if (feature.layer.id.startsWith("twin-sensors")) {
    const variable = typeof p.variable === "string" && p.variable in VARIABLES ? p.variable as Variable : useTwinStore.getState().variable;
    useTwinStore.setState({ variable, selection: { kind: "sensor", stationId: Number(p.stationId) } });
    useRegionalStore.setState({ selection: null, detailId: null, tab: "layers" });
  } else if (feature.layer.id === "twin-aia" && feature.geometry.type === "Point") {
    useTwinStore.setState({ selection: { kind: "asset", name: String(p.name ?? p.ragione_sociale ?? "Attività"), coordinates: feature.geometry.coordinates.slice(0, 2) as [number, number], properties: p } });
    useRegionalStore.setState({ selection: null, detailId: null, tab: "layers" });
  }
  useAppStore.setState({ drawerOpen: true });
}

/** Non-modal reading sheet: every visible record at the same coordinates, no
 * aggregation of units, depths or timestamps and no limit on the record list. */
export function mountPointReadings(map: MLMap) {
  let popup: Popup | null = null, anchor: [number, number] | null = null, frame = 0;
  let root: HTMLElement | null = null, signature = "", request = 0;
  let clustered = false, disposed = false;
  function close(focus = false) {
    request++;
    popup?.remove(); popup = null; root = null; anchor = null; signature = ""; clustered = false;
    openMaps.delete(map);
    if (focus) map.getCanvas().focus({ preventScroll: true });
  }
  function render(features: MapGeoJSONFeature[], focus = false) {
    const nextSignature = JSON.stringify(features.map(f => [dataFeatureKey(f), readingText(f)]));
    if (!focus && signature === nextSignature) return;
    signature = nextSignature;
    const activeKey = root?.contains(document.activeElement) ? (document.activeElement as HTMLElement).dataset.reading : undefined;
    const scroll = root?.querySelector("ol")?.scrollTop ?? 0;
    const node = document.createElement("section");
    node.className = styles.sheet!;
    const position = map.project(anchor!), { clientHeight: height, clientWidth: width } = map.getContainer();
    const above = position.y >= height / 2 - 1;
    const side = height < 400 && width >= 650 && position.y > height * .3 && position.y < height * .7;
    const vertical = above ? "bottom" : "top", edge = Math.min(328, width - 58) / 2 + 10;
    const popupAnchor = side ? (position.x >= width / 2 - 1 ? "right" : "left")
      : position.x < edge ? `${vertical}-left` as const
      : position.x > width - edge ? `${vertical}-right` as const : vertical;
    const room = side ? 2 * Math.min(position.y, height - position.y) - 24 : (above ? position.y : height - position.y) - 30;
    node.style.setProperty("--point-readings-height", `${Math.max(80, room)}px`);
    node.setAttribute("role", "dialog"); node.setAttribute("aria-label", "Dati nello stesso punto");
    const header = document.createElement("header"), heading = document.createElement("h2"), dismiss = document.createElement("button");
    heading.textContent = `${features.length} dati in questo punto`;
    dismiss.type = "button"; dismiss.textContent = "×"; dismiss.setAttribute("aria-label", "Chiudi dati del punto");
    dismiss.addEventListener("click", () => close(true));
    header.append(heading, dismiss);
    const hint = document.createElement("p"); hint.textContent = "Tutte le letture dei livelli visibili. Seleziona una voce per approfondire.";
    const list = document.createElement("ol"); list.setAttribute("aria-label", "Letture disponibili");
    for (const feature of features) {
      const text = readingText(feature), item = document.createElement("li"), button = document.createElement("button");
      button.type = "button"; button.dataset.reading = dataFeatureKey(feature);
      button.style.setProperty("--reading-color", text.color);
      const title = document.createElement("strong"), value = document.createElement("span"), detail = document.createElement("small");
      title.textContent = text.title; value.textContent = text.value; detail.textContent = text.detail;
      button.append(title, value, detail);
      button.addEventListener("click", () => {
        close(); selectPointReading(feature);
        requestAnimationFrame(() => {
          const target = document.querySelector<HTMLElement>('#drawer-panel [aria-label="Dettaglio livello"] h2');
          if (target) { target.tabIndex = -1; target.focus({ preventScroll: true }); }
        });
      });
      item.append(button); list.append(item);
    }
    node.append(header, hint, list);
    node.addEventListener("keydown", e => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(true); }
    });
    root = node;
    if (!popup) popup = new Popup({ closeButton: false, closeOnClick: false, focusAfterOpen: false, anchor: popupAnchor, offset: 18, maxWidth: "min(360px, calc(100vw - 32px))", className: styles.popup! }).setLngLat(anchor!).setDOMContent(node).addTo(map);
    else popup.setDOMContent(node);
    list.scrollTop = scroll;
    const restore = activeKey && Array.from(list.querySelectorAll("button")).find(b => b.dataset.reading === activeKey);
    if (restore) restore.focus({ preventScroll: true });
    else if (focus) dismiss.focus({ preventScroll: true });
  }
  function show(features: MapGeoJSONFeature[], focus = true) {
    const point = features[0]?.geometry;
    if (point?.type !== "Point") return;
    anchor = point.coordinates.slice(0, 2) as [number, number];
    openMaps.add(map); render(features, focus);
  }
  function isSamePoint(features: MapGeoJSONFeature[]) {
    const first = features[0]?.geometry;
    return first?.type === "Point" && features.every(f => f.geometry.type === "Point" &&
      Math.abs(f.geometry.coordinates[0]! - first.coordinates[0]!) < 1e-7 &&
      Math.abs(f.geometry.coordinates[1]! - first.coordinates[1]!) < 1e-7);
  }
  async function expand(features: MapGeoJSONFeature[], serial: number, focus: boolean) {
    const group = features.find(f => f.properties?.cluster);
    if (!group) return;
    const source = map.getSource(group.source) as GeoJSONSource;
    try {
      const records = (await Promise.all(features.map(async feature => {
        if (!feature.properties?.cluster) return [feature];
        const src = map.getSource(feature.source) as GeoJSONSource;
        const leaves = await src.getClusterLeaves(Number(feature.properties.cluster_id), Number(feature.properties.point_count), 0);
        return leaves.map(leaf => ({ ...leaf, source: feature.source, layer: { ...feature.layer, id: feature.source + "-point" } }) as unknown as MapGeoJSONFeature);
      }))).flat();
      if (disposed || serial !== request || map.getSource(group.source) !== source) return;
      if (records.length > 1 && records.every(f => !f.properties?.__overview) && isSamePoint(records) && (focus || !anchor || (records[0]!.geometry.type === "Point" && Math.abs(records[0]!.geometry.coordinates[0]! - anchor[0]) < 1e-7 && Math.abs(records[0]!.geometry.coordinates[1]! - anchor[1]) < 1e-7))) { clustered = true; show(records, focus); return; }
      if (!focus) { close(); return; }
      const zoom = await source.getClusterExpansionZoom(Number(group.properties.cluster_id));
      if (disposed || serial !== request || map.getSource(group.source) !== source || group.geometry.type !== "Point") return;
      const animate = useAppearance.getState().motion && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      map.easeTo({ center: group.geometry.coordinates.slice(0, 2) as [number, number], zoom: Math.min(group.source==="nature-nodes"?18:16, zoom + .1), duration: animate ? 400 : 0 });
    } catch { if (!disposed && serial === request) close(); /* Source may refresh while reading leaves. */ }
  }
  function click(event: MapMouseEvent) {
    if (useAppStore.getState().drawingMode || isProbeClick(event)) return;
    const features = pickDataFeatures(map, event.point, window.matchMedia("(pointer: coarse)").matches ? 22 : 8);
    close();
    // Overview cells are geographic navigation references, not readings.
    if (!features.length || features.some(f => f.properties?.__overview)) return;
    if (features.some(f => f.properties?.cluster)) {
      consumed.add(event.originalEvent ?? event);
      void expand(features, request, true);
      return;
    }
    if (features.length < 2) return;
    consumed.add(event.originalEvent ?? event);
    show(features);
  }
  function refresh() {
    if (!anchor || frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0; if (!anchor) return;
      const features = pickDataFeatures(map, map.project(anchor), 1).filter(f => f.geometry.type === "Point" && !f.properties?.__overview && (clustered && f.properties?.cluster ||
        Math.abs(f.geometry.coordinates[0]! - anchor![0]) < 1e-7 && Math.abs(f.geometry.coordinates[1]! - anchor![1]) < 1e-7));
      if (clustered && features.some(f => f.properties?.cluster)) { void expand(features, ++request, false); return; }
      const readings = features.filter(f => !f.properties?.cluster);
      if (!readings.length) close(); else render(readings);
    });
  }
  const unsubExperience = useExperienceStore.subscribe((s, p) => { if (s.activeId !== p.activeId || s.probe !== p.probe) close(); });
  const unsubRegional = useRegionalStore.subscribe((s, p) => { if (s.enabled !== p.enabled || s.filters !== p.filters || s.entries !== p.entries) refresh(); });
  const loading = () => close();
  const unsub = useAppStore.subscribe((s, p) => { if (s.drawingMode !== p.drawingMode && s.drawingMode) close(); });
  map.on("click", click); map.on("sourcedata", refresh); map.on("resize", refresh); map.on("styledataloading", loading);
  return () => {
    disposed = true; cancelAnimationFrame(frame); close(); unsub(); unsubRegional(); unsubExperience();
    map.off("click", click); map.off("sourcedata", refresh); map.off("resize", refresh); map.off("styledataloading", loading);
  };
}
