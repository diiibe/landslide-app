import { Popup, type Map as MLMap, type MapGeoJSONFeature, type MapMouseEvent, type GeoJSONSource } from "maplibre-gl";
import { useAppearance } from "@/ui/appearance";
import { useAppStore } from "@/app/store";
import { useTwinStore } from "./store";
import { variableMeasures, VARIABLES, type Variable } from "./data";
import { isPCREnabled } from "@/regional/builtins";
import { useRegionalStore } from "@/regional/store";
import { pickDataFeature } from "@/regional/mapPicking";

const SENSOR = "twin-sensors", AIA = "twin-aia";
const FOCUS = "twin-selection", OUTLINE = "twin-selection-outline", PULSE = "twin-selection-feedback";
const empty: GeoJSON.FeatureCollection<GeoJSON.Point> = { type: "FeatureCollection", features: [] };

/** Point controls keep a 44px touch target without enlarging building hits. */
export function pickTwinFeature(map: MLMap, point: { x: number; y: number }, radius: number): MapGeoJSONFeature | undefined {
  const pointLayers = [SENSOR, `${SENSOR}-labels`, AIA].filter(id => map.getLayer(id));
  const layers = [...pointLayers, "twin-buildings-3d", "twin-buildings"].filter(id => map.getLayer(id));
  if (!layers.length) return;
  const exact = map.queryRenderedFeatures([point.x, point.y], { layers });
  const distance = (feature: MapGeoJSONFeature) => {
    if (feature.geometry.type !== "Point") return Infinity;
    const p = map.project(feature.geometry.coordinates.slice(0, 2) as [number, number]);
    return Math.hypot(p.x - point.x, p.y - point.y);
  };
  const exactPoints = exact.filter(f => f.geometry.type === "Point");
  if (exactPoints.length) return exactPoints.sort((a, b) => distance(a) - distance(b))[0];
  if (pointLayers.length) {
    const nearby = map.queryRenderedFeatures(
      [[point.x - radius, point.y - radius], [point.x + radius, point.y + radius]],
      { layers: pointLayers },
    ).filter(f => f.geometry.type === "Point" && distance(f) <= radius);
    if (nearby.length) return nearby.sort((a, b) => distance(a) - distance(b))[0];
  }
  return exact[0];
}
const reducedMotion = () => !useAppearance.getState().motion || (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? true);

export function mountTwinInteractions(map: MLMap, isReady: () => boolean) {
  let popup: Popup | null = null, ownsCursor = false, frame = 0, lastFocusKey = "";
  let hoverKey = "", lastHoverTime = 0;
  let focused: GeoJSON.FeatureCollection<GeoJSON.Point> = empty;
  function clearHover() {
    popup?.remove(); popup = null;
    hoverKey = "";
    if (ownsCursor) map.getCanvas().style.cursor = "";
    ownsCursor = false;
  }
  function stopFeedback() {
    cancelAnimationFrame(frame); frame = 0;
    if (isReady() && map.getLayer(PULSE)) map.setPaintProperty(PULSE, "circle-stroke-opacity", 0);
  }
  function feedback() {
    stopFeedback();
    if (reducedMotion() || document.hidden) return;
    const start = performance.now();
    let previous = -100;
    const tick = (time: number) => {
      if (!isReady() || !useTwinStore.getState().active || document.hidden || reducedMotion() || !map.getLayer(PULSE)) {
        stopFeedback(); return;
      }
      const t = Math.min(1, (time - start) / 420);
      if (time - previous >= 32 || t === 1) {
        map.setPaintProperty(PULSE, "circle-radius", 13 + t * 10);
        map.setPaintProperty(PULSE, "circle-stroke-opacity", (1 - t) * 0.75);
        previous = time;
      }
      if (t < 1) frame = requestAnimationFrame(tick);
      else frame = 0;
    };
    frame = requestAnimationFrame(tick);
  }
  function sync() {
    if (!isReady()) return;
    const state = useTwinStore.getState(), selected = state.selection;
    let coordinates: [number, number] | null = null, key = "", color = "#5ebfcc";
    if (state.active && selected?.kind === "sensor" && isPCREnabled(state.variable)) {
      const measure = variableMeasures(state.measures, state.variable).find(m => m.stationId === selected.stationId);
      if (measure) {
        coordinates = [measure.lon, measure.lat];
        key = `sensor:${measure.stationId}:${state.variable}:${measure.time}:${measure.value}`;
      }
    } else if (state.active && selected?.kind === "asset" && state.assetsOn) {
      coordinates = selected.coordinates;
      key = `asset:${coordinates.join(":")}:${selected.name}`;
      color = "#e0b361";
    }
    const changed = key !== lastFocusKey;
    if (changed) focused = coordinates ? {
      type: "FeatureCollection",
      features: [{ type: "Feature", geometry: { type: "Point", coordinates }, properties: { color } }],
    } : empty;
    const source = map.getSource(FOCUS);
    if (!source) map.addSource(FOCUS, { type: "geojson", data: focused });
    else if (changed) (source as GeoJSONSource).setData(focused);
    for (const id of [OUTLINE, FOCUS, PULSE]) {
      const pulse = id === PULSE;
      if (!map.getLayer(id)) map.addLayer({
        id, type: "circle", source: FOCUS,
        paint: { "circle-radius": 13, "circle-opacity": 0, "circle-stroke-color": id === OUTLINE ? "#172624" : ["get", "color"], "circle-stroke-width": id === OUTLINE ? 6 : pulse ? 2 : 3, "circle-stroke-opacity": pulse ? 0 : 1 },
      });
      map.setLayoutProperty(id, "visibility", state.active && coordinates ? "visible" : "none");
    }
    if (!state.active) clearHover();
    if (changed) {
      lastFocusKey = key;
      if (coordinates) feedback(); else stopFeedback();
    }
  }
  function hover(event: MapMouseEvent) {
    if (!isReady() || !useTwinStore.getState().active || useAppStore.getState().drawingMode) return;
    if (!(window.matchMedia?.("(hover: hover)").matches ?? false)) return;
    if (map.isMoving()) { clearHover(); return; }
    if (performance.now() - lastHoverTime < 32) return;
    lastHoverTime = performance.now();
    const hit = pickDataFeature(map, event.point, 8);
    const feature = hit && !hit.layer.id.startsWith("regional-") ? hit : undefined;
    if (!feature) { clearHover(); return; }
    map.getCanvas().style.cursor = "pointer"; ownsCursor = true;
    const p = feature.properties ?? {}, node = document.createElement("div");
    const key = `${feature.layer.id}:${String(feature.id ?? p.stationId ?? p.name ?? p.id)}:${String(p.label)}:${String(p.observedAt)}:${String(p.freshness)}`;
    if (popup && key === hoverKey) { popup.setLngLat(event.lngLat); return; }
    hoverKey = key;
    node.setAttribute("role", "tooltip");
    const title = document.createElement("strong");
    title.textContent = String(p.name || p.ragione_sociale || (feature.geometry.type === "Point" ? "Punto osservato" : "Edificio"));
    node.append(title);
    const detail = document.createElement("div");
    detail.textContent = feature.layer.id.startsWith(SENSOR)
      ? `${String(p.label)} · ${String(p.observedAt)} · ${String(p.freshness)}`
      : feature.layer.id === AIA ? "Registro AIA · tocca per i dettagli" : "Edificato 2017–2020 · tocca per i dettagli";
    node.append(detail);
    if (!popup) {
      popup = new Popup({ closeButton: false, closeOnClick: false, offset: 16, maxWidth: "260px" });
      popup.setLngLat(event.lngLat).setDOMContent(node).addTo(map);
    } else popup.setLngLat(event.lngLat).setDOMContent(node);
  }
  function click(event: MapMouseEvent) {
    if (!isReady() || !useTwinStore.getState().active || useAppStore.getState().drawingMode) return;
    const touch = window.matchMedia?.("(pointer: coarse)").matches ?? false;
    const hit = pickDataFeature(map, event.point, touch ? 22 : 8);
    const feature = hit && !hit.layer.id.startsWith("regional-") ? hit : undefined;
    if (!feature) return;
    clearHover();
    const p = feature.properties ?? {};
    if (feature.layer.id.startsWith(SENSOR)) {
      const variable = typeof p.variable === "string" && p.variable in VARIABLES ? p.variable as Variable : useTwinStore.getState().variable;
      useTwinStore.setState({ variable, selection: { kind: "sensor", stationId: Number(p.stationId) } });
    }
    else if (feature.layer.id === AIA && feature.geometry.type === "Point")
      useTwinStore.setState({ selection: { kind: "asset", name: String(p.name || p.ragione_sociale), coordinates: feature.geometry.coordinates.slice(0, 2) as [number, number], properties: p } });
    else useTwinStore.setState({ selection: { kind: "building", properties: p } });
    useRegionalStore.setState({ selection: null, detailId: null, tab: "layers" });
    useAppStore.setState({ drawerOpen: true });
  }
  function visibility() { if (document.hidden) { clearHover(); stopFeedback(); } }
  map.on("mousemove", hover); map.on("mouseout", clearHover); map.on("click", click);
  document.addEventListener("visibilitychange", visibility);
  return {
    sync,
    invalidateHover: clearHover,
    reset: () => { clearHover(); stopFeedback(); },
    dispose: () => {
      clearHover(); stopFeedback();
      map.off("mousemove", hover); map.off("mouseout", clearHover); map.off("click", click);
      document.removeEventListener("visibilitychange", visibility);
    },
  };
}
