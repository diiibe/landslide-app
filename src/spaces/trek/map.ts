import type { Map as MLMap, GeoJSONSource, MapMouseEvent } from "maplibre-gl";
import { Popup } from "maplibre-gl";
import { useAppearance } from "@/ui/appearance";
import { useAppStore } from "@/app/store";
import { createHoverCard } from "@/map/hoverCard";
import {
  hasPointReadings,
  isPointReadingClick,
} from "@/regional/pointReadings";
import { selectObject, useExperienceStore } from "../store";
import { NODES, nodeState, stateTone, stateLabel } from "./model";
import { useTrekStore } from "./store";
import network from "./network.json";
const ids = [
  "trek-route-ground",
  "trek-route",
  "trek-links",
  "trek-node-ring",
  "trek-node",
  "trek-node-label",
  "trek-hit",
];
const sourceIds = ["trek-route", "trek-links", "trek-nodes"];
export function trekNodes(time: number): GeoJSON.FeatureCollection {
  const s = useTrekStore.getState(),
    selected = useExperienceStore.getState().selectedId;
  return {
    type: "FeatureCollection",
    features: NODES.map((node) => {
      const state = nodeState(node, time, s.scenario),
        r = state.sample;
      return {
        type: "Feature",
        id: node.id,
        geometry: { type: "Point", coordinates: node.coordinates },
        properties: {
          id: node.id,
          __featureId: node.id,
          name: node.name,
          selected: node.id === selected ? 1 : 0,
          master: node.role === "master" ? 1 : 0,
          label:
            s.view === "passages"
              ? `${node.number} · ${r.ble} BLE`
              : `${node.number}${node.role === "master" ? " · Master" : ""}`,
          readingDetail: `Demo · ${stateLabel[state.status]} · campione ${new Date(r.at).toLocaleTimeString("it-IT", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit" })}`,
          readingValue: `${r.ble} dispositivi BLE · ${r.powerMw.toLocaleString("it-IT")} mW`,
          color:
            s.view === "passages" && state.status === "ok"
              ? r.ble > 8
                ? "#dfb973"
                : r.ble > 3
                  ? "#9ac9aa"
                  : "#6f9e88"
              : stateTone[state.status],
        },
      };
    }),
  };
}
export function mountTrekMap(m: MLMap) {
  let ready = !!m.isStyleLoaded(),
    disposed = false,
    hover: Popup | null = null,
    hoverId: string | null = null,
    timer: ReturnType<typeof setInterval> | undefined;
  const source = (id: string, data: GeoJSON.FeatureCollection) => {
    const current = m.getSource(id) as GeoJSONSource | undefined;
    if (current) current.setData(data);
    else
      m.addSource(id, {
        type: "geojson",
        data,
        ...(id === "trek-route"
          ? {
              attribution:
                '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · postazioni virtuali',
            }
          : {}),
      });
  };
  let fitFrame = 0,
    fitPending = false;
  function scheduleFit() {
    cancelAnimationFrame(fitFrame);
    fitFrame = requestAnimationFrame(() => {
      fitFrame = 0;
      if (
        disposed ||
        !fitPending ||
        useExperienceStore.getState().activeId !== "trek"
      )
        return;
      if (!ready) return;
      fitPending = false;
      const container = m.getContainer(),
        box = container.getBoundingClientRect(),
        control = document
          .getElementById("extensions-trigger")
          ?.getBoundingClientRect();
      const w = container.clientWidth,
        h = container.clientHeight,
        portrait = h > w;
      const points = network.route.geometry.coordinates,
        x = points.map((p) => p[0]!),
        y = points.map((p) => p[1]!);
      m.fitBounds(
        [
          [Math.min(...x), Math.min(...y)],
          [Math.max(...x), Math.max(...y)],
        ],
        {
          padding: {
            left: 44,
            right: portrait
              ? 28
              : Math.min(Math.max(0, w - 120), (control?.width ?? 200) + 32),
            top: portrait
              ? Math.max(
                  64,
                  Math.min(
                    h - 130,
                    (control?.bottom ?? box.top + 200) - box.top + 20,
                  ),
                )
              : 72,
            bottom: 64,
          },
          maxZoom: 15,
          pitch: 0,
          duration:
            useAppearance.getState().motion &&
            !window.matchMedia("(prefers-reduced-motion: reduce)").matches
              ? 350
              : 0,
        },
      );
    });
  }
  const onFit = () => {
    fitPending = true;
    scheduleFit();
  };
  function clearHover() {
    if (hoverId && !useAppStore.getState().drawingMode)
      m.getCanvas().style.cursor = "";
    hover?.remove();
    hover = null;
    hoverId = null;
  }
  function remove() {
    fitPending = false;
    cancelAnimationFrame(fitFrame);
    fitFrame = 0;
    clearHover();
    for (const id of [...ids].reverse()) if (m.getLayer(id)) m.removeLayer(id);
    for (const id of sourceIds) if (m.getSource(id)) m.removeSource(id);
  }
  function sync() {
    if (disposed || !ready) return;
    if (useExperienceStore.getState().activeId !== "trek") {
      remove();
      return;
    }
    const now = useExperienceStore.getState().replayTime ?? Date.now(),
      s = useTrekStore.getState();
    source("trek-nodes", trekNodes(now));
    if (!m.getSource("trek-route"))
      source("trek-route", {
        type: "FeatureCollection",
        features: [network.route as GeoJSON.Feature],
      });
    if (!m.getSource("trek-links"))
      source("trek-links", {
        type: "FeatureCollection",
        features: NODES.filter((n) => n.next).map((n) => ({
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [
              n.coordinates,
              NODES.find((p) => p.id === n.next)!.coordinates,
            ],
          },
        })),
      });
    if (!m.getLayer("trek-route")) {
      m.addLayer({
        id: "trek-route-ground",
        type: "line",
        source: "trek-route",
        paint: {
          "line-color": "#213b2e",
          "line-width": 6,
          "line-opacity": 0.8,
        },
      });
      m.addLayer({
        id: "trek-route",
        type: "line",
        source: "trek-route",
        paint: {
          "line-color": "#a0c9a6",
          "line-width": 2.5,
          "line-opacity": 0.9,
        },
      });
      m.addLayer({
        id: "trek-links",
        type: "line",
        source: "trek-links",
        paint: {
          "line-color": "#d9b976",
          "line-width": 1.8,
          "line-dasharray": [3, 3],
          "line-opacity": 0.8,
        },
      });
      m.addLayer({
        id: "trek-node-ring",
        type: "circle",
        source: "trek-nodes",
        paint: {
          "circle-radius": [
            "case",
            ["==", ["get", "selected"], 1],
            16,
            ["==", ["get", "master"], 1],
            12,
            10,
          ],
          "circle-color": ["get", "color"],
          "circle-opacity": ["case", ["==", ["get", "selected"], 1], 0.4, 0.15],
        },
      });
      m.addLayer({
        id: "trek-node",
        type: "circle",
        source: "trek-nodes",
        paint: {
          "circle-radius": ["case", ["==", ["get", "master"], 1], 8, 6],
          "circle-color": ["get", "color"],
          "circle-stroke-color": "#eff5ea",
          "circle-stroke-width": 1.5,
        },
      });
      m.addLayer({
        id: "trek-node-label",
        type: "symbol",
        source: "trek-nodes",
        minzoom: 11,
        layout: {
          "text-field": ["get", "label"],
          "text-font": ["Open Sans Semibold"],
          "text-size": 12,
          "text-offset": [0, 1.5],
          "text-anchor": "top",
        },
        paint: {
          "text-color": "#e9f2e6",
          "text-halo-color": "#20372a",
          "text-halo-width": 1.5,
        },
      });
      m.addLayer({
        id: "trek-hit",
        type: "circle",
        source: "trek-nodes",
        paint: { "circle-radius": 22, "circle-opacity": 0 },
      });
    }
    for (const id of ["trek-route-ground", "trek-route"])
      m.setLayoutProperty(id, "visibility", s.showRoute ? "visible" : "none");
    m.setLayoutProperty(
      "trek-links",
      "visibility",
      s.showLinks ? "visible" : "none",
    );
    if (hasPointReadings(m) || useAppStore.getState().drawingMode) clearHover();
    else if (hoverId) updateHover(hoverId, now);
  }
  function updateHover(id: string, time: number) {
    const f = trekNodes(time).features.find((f) => f.properties?.id === id);
    if (!f || f.geometry.type !== "Point") {
      clearHover();
      return;
    }
    const p = f.properties!;
    const card = createHoverCard(
      String(p.name),
      `${p.readingValue} · ${p.readingDetail}`,
      String(p.color),
    );
    if (!hover)
      hover = new Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 16,
        className: "fvg-sensor-hover",
        maxWidth: "280px",
      })
        .setLngLat(f.geometry.coordinates as [number, number])
        .setDOMContent(card)
        .addTo(m);
    else hover.setDOMContent(card);
    hoverId = id;
  }
  function hits(e: MapMouseEvent) {
    return m.getLayer("trek-hit")
      ? m.queryRenderedFeatures(e.point, { layers: ["trek-hit"] })
      : [];
  }
  function click(e: MapMouseEvent) {
    clearHover();
    if (
      !ready ||
      useExperienceStore.getState().activeId !== "trek" ||
      useAppStore.getState().drawingMode ||
      isPointReadingClick(e)
    )
      return;
    const f = hits(e)[0];
    if (f) {
      clearHover();
      selectObject(String(f.properties.id));
    }
  }
  function move(e: MapMouseEvent) {
    if (
      !ready ||
      useExperienceStore.getState().activeId !== "trek" ||
      useAppStore.getState().drawingMode ||
      hasPointReadings(m)
    ) {
      clearHover();
      return;
    }
    const f = hits(e)[0];
    if (!f) {
      clearHover();
      return;
    }
    m.getCanvas().style.cursor = "pointer";
    if (hoverId !== f.properties.id)
      updateHover(
        String(f.properties.id),
        useExperienceStore.getState().replayTime ?? Date.now(),
      );
  }
  const load = () => {
      ready = true;
      sync();
      if (fitPending) scheduleFit();
    },
    loading = () => {
      ready = false;
      clearHover();
    },
    out = () => {
      clearHover();
    };
  const active = () => {
    if (timer) clearInterval(timer);
    timer = undefined;
    if (
      !disposed &&
      document.visibilityState !== "hidden" &&
      useExperienceStore.getState().activeId === "trek"
    ) {
      sync();
      timer = setInterval(sync, 1000);
    } else clearHover();
  };
  const unsub = useExperienceStore.subscribe((s, p) => {
    if (s.activeId !== p.activeId) {
      sync();
      active();
    } else if (s.selectedId !== p.selectedId || s.replayTime !== p.replayTime)
      sync();
  });
  const unsubTrek = useTrekStore.subscribe(sync),
    unsubApp = useAppStore.subscribe((s, p) => {
      if (s.drawingMode !== p.drawingMode) clearHover();
    });
  window.addEventListener("fvg:trek-fit", onFit);
  m.on("style.load", load);
  m.on("styledataloading", loading);
  m.on("click", click);
  m.on("mousemove", move);
  m.getCanvas().addEventListener("mouseout", out);
  document.addEventListener("visibilitychange", active);
  active();
  return () => {
    disposed = true;
    window.removeEventListener("fvg:trek-fit", onFit);
    if (timer) clearInterval(timer);
    unsub();
    unsubTrek();
    unsubApp();
    document.removeEventListener("visibilitychange", active);
    m.off("style.load", load);
    m.off("styledataloading", loading);
    m.off("click", click);
    m.off("mousemove", move);
    m.getCanvas().removeEventListener("mouseout", out);
    remove();
  };
}
