import { isPointReadingClick } from "@/regional/pointReadings";
import { consumeProbeClick } from "./interactions";
import maplibregl, {
  type Map as MLMap,
  type GeoJSONSource,
  type MapMouseEvent,
  type ExpressionSpecification,
} from "maplibre-gl";
import { useAppStore } from "@/app/store";
import { RAMP_STOPS } from "@/map/style";
import { experience, polygonAt } from "./experiences";
import {
  demoTime,
  selectArea,
  selectObject,
  useExperienceStore,
} from "./store";
import { reading, virtualTrips } from "./simulation";
import type { Experience } from "./types";
const EMPTY: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};
const SOURCES = [
  "space-boundary",
  "space-zones",
  "space-sensors",
  "space-routes",
  "space-vehicles",
  "space-area",
  "space-context-roads",
  "space-context-trails",
];
const LAYERS = [
  "space-boundary-fill",
  "space-boundary-line",
  "space-zone-fill",
  "space-zone-line",
  "space-zone-volume",
  "space-zone-label",
  "space-route",
  "space-sensor-halo",
  "space-sensor",
  "space-sensor-label",
  "space-sensor-hit",
  "space-vehicle",
  "space-area-fill",
  "space-area-line",
  "space-context-roads-line",
  "space-context-trails-line",
];
interface Manifest {
  networks: Record<"roads" | "trails", { tiles: string; tileSha: string }>;
}
const feature = (
  geometry: GeoJSON.Geometry,
  properties: Record<string, unknown> = {},
): GeoJSON.Feature => ({ type: "Feature", properties, geometry });
const collection = (
  features: GeoJSON.Feature[],
): GeoJSON.FeatureCollection => ({ type: "FeatureCollection", features });
function sensorData(scene: Experience, t: number): GeoJSON.FeatureCollection {
  const state = useExperienceStore.getState();
  if (!state.showSensors) return EMPTY;
  return collection(
    scene.sensors
      .filter((a) => state.filter === "all" || a.metric === state.filter)
      .map((a) => {
        const s = reading(scene, a, t, state.scenario);
        return feature(
          { type: "Point", coordinates: a.coordinates },
          {
            id: a.id,
            name: a.name,
            value: s.value,
            label: `${new Intl.NumberFormat("it-IT", { maximumFractionDigits: 1 }).format(s.value)} ${a.unit}`,
            color:
              s.status === "alert"
                ? "#ee5143"
                : s.status === "watch"
                  ? "#dda13b"
                  : scene.tone,
            selected: state.selectedId === a.id ? 1 : 0,
          },
        );
      }),
  );
}
function vehicles(scene: Experience, t: number): GeoJSON.FeatureCollection {
  if (!useExperienceStore.getState().showVehicles) return EMPTY;
  const scenario = useExperienceStore.getState().scenario;
  return collection(
    scene.routes.flatMap((_, i) =>
      virtualTrips(scene, i, t, scenario).map((trip) =>
        feature(
          { type: "Point", coordinates: trip.coordinates },
          { id: trip.id, color: scene.tone },
        ),
      ),
    ),
  );
}
export function mountExperienceMap(m: MLMap): () => void {
  let ready = !!m.isStyleLoaded(),
    disposed = false,
    installed: string | null = null,
    frame = 0,
    lastSensors = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let manifest: Manifest | null = null,
    manifestPending = false;
  let popup: maplibregl.Popup | null = null,
    hovered = "";
  const source = (id: string, data: GeoJSON.FeatureCollection) => {
    if (m.getSource(id)) (m.getSource(id) as GeoJSONSource).setData(data);
    else m.addSource(id, { type: "geojson", data });
  };
  const layer = (spec: Parameters<MLMap["addLayer"]>[0]) => {
    if (!m.getLayer(spec.id)) m.addLayer(spec);
  };
  function remove() {
    for (const id of [...LAYERS].reverse())
      if (m.getLayer(id)) m.removeLayer(id);
    for (const id of SOURCES) if (m.getSource(id)) m.removeSource(id);
    installed = null;
    popup?.remove();
    popup = null;
  }
  function context() {
    const s = useExperienceStore.getState();
    if (manifestPending || manifest || s.contextError) return;
    manifestPending = true;
    void fetch(`${import.meta.env.BASE_URL}data/spaces/manifest.json`, {
      cache: "no-cache",
    })
      .then((r) => {
        if (!r.ok)
          throw new Error(`Reti di contesto non disponibili (${r.status}).`);
        return r.json() as Promise<Manifest>;
      })
      .then((data) => {
        manifestPending = false;
        if (disposed) return;
        manifest = data;
        sync();
      })
      .catch((e) => {
        manifestPending = false;
        if (!disposed)
          useExperienceStore.setState({
            contextError:
              e instanceof Error ? e.message : "Reti non disponibili.",
          });
      });
  }
  function clearHover() {
    popup?.remove();
    popup = null;
    hovered = "";
  }
  function updateHover(scene: Experience, at: number) {
    const asset = scene.sensors.find((a) => a.id === hovered);
    if (!popup || !asset) return;
    const v = reading(scene, asset, at, useExperienceStore.getState().scenario);
    popup.setText(
      `${asset.name} · ${v.value.toLocaleString("it-IT", { maximumFractionDigits: 1 })} ${asset.unit} · simulato`,
    );
  }
  function sync() {
    clearHover();
    if (disposed || !ready) return;
    const s = useExperienceStore.getState(),
      a = useAppStore.getState(),
      scene = experience(s.activeId);
    if (
      !scene ||
      scene.id === "landslides" ||
      s.replayTime !== null ||
      document.visibilityState === "hidden"
    ) {
      if (timer) clearTimeout(timer);
      timer = null;
      cancelAnimationFrame(frame);
      frame = 0;
    }
    if (installed !== s.activeId) remove();
    if (!scene) return;
    if (scene.id === "landslides") {
      installed = scene.id;
      context();
      const area = s.area;
      source("space-area", area ? collection([feature(area.geometry)]) : EMPTY);
      layer({
        id: "space-area-fill",
        type: "fill",
        source: "space-area",
        paint: { "fill-color": "#315eaa", "fill-opacity": 0.07 },
      });
      layer({
        id: "space-area-line",
        type: "line",
        source: "space-area",
        paint: {
          "line-color": a.theme === "dark" ? "#9cc5ff" : "#2459a4",
          "line-width": 2.5,
          "line-dasharray": [3, 1],
        },
      });
      if (manifest) {
        for (const name of ["roads", "trails"] as const) {
          const id = `space-context-${name}`,
            line = id + "-line",
            entry = manifest.networks[name];
          if (!m.getSource(id))
            m.addSource(id, {
              type: "vector",
              url: `pmtiles://${import.meta.env.BASE_URL}tiles/${entry.tiles}?v=${entry.tileSha}`,
            });
          const field = a.layers.v2Diffuse ? "d" : "b";
          const paint = [
            "interpolate",
            ["linear"],
            ["get", field],
            0,
            a.theme === "dark" ? "#a5b4ba" : "#74827e",
            ...RAMP_STOPS.map(([v, c]) => [v * 4 + 1, c]).flat(),
          ] as ExpressionSpecification;
          layer({
            id: line,
            type: "line",
            source: id,
            "source-layer": "network",
            paint: {
              "line-color": paint,
              "line-width": [
                "interpolate",
                ["linear"],
                ["zoom"],
                7,
                name === "roads" ? 1 : 0.5,
                14,
                name === "roads" ? 3 : 1.7,
              ],
              "line-opacity": 0.88,
            },
            layout: { "line-cap": "round", "line-join": "round" },
          });
          m.setPaintProperty(line, "line-color", paint);
          m.setLayoutProperty(
            line,
            "visibility",
            a.layers[name] ? "visible" : "none",
          );
          if (name === "trails")
            m.setPaintProperty(line, "line-dasharray", [3, 2]);
        }
        if (!s.contextReady)
          useExperienceStore.setState({ contextReady: true });
      }
      m.getCanvas().style.cursor = s.probe ? "crosshair" : "";
      return;
    }
    const first = installed !== scene.id;
    installed = scene.id;
    if (first) {
      source(
        "space-boundary",
        scene.perimeter ? collection([feature(scene.perimeter)]) : EMPTY,
      );
      source(
        "space-zones",
        collection(
          scene.zones.map((z) =>
            feature(z.geometry, {
              id: z.id,
              name: z.name,
              color: z.color,
              height:
                z.kind === "Produzione"
                  ? 14
                  : [
                        "Negozio",
                        "Servizi",
                        "Ristorazione",
                        "Accoglienza",
                      ].includes(z.kind)
                    ? 7
                    : 0,
            }),
          ),
        ),
      );
      source(
        "space-routes",
        collection(
          scene.routes.map((r) =>
            feature(
              { type: "LineString", coordinates: r.coordinates },
              { id: r.id, name: r.name },
            ),
          ),
        ),
      );
      source("space-sensors", sensorData(scene, demoTime()));
      source("space-vehicles", vehicles(scene, demoTime()));
    }
    layer({
      id: "space-boundary-fill",
      type: "fill",
      source: "space-boundary",
      paint: { "fill-color": scene.tone, "fill-opacity": 0.035 },
    });
    layer({
      id: "space-boundary-line",
      type: "line",
      source: "space-boundary",
      paint: {
        "line-color": scene.tone,
        "line-width": 2,
        "line-dasharray": [5, 2],
      },
    });
    layer({
      id: "space-zone-fill",
      type: "fill",
      source: "space-zones",
      paint: { "fill-color": ["get", "color"], "fill-opacity": 0.18 },
    });
    layer({
      id: "space-zone-line",
      type: "line",
      source: "space-zones",
      paint: { "line-color": ["get", "color"], "line-width": 1.3 },
    });
    layer({
      id: "space-zone-volume",
      type: "fill-extrusion",
      source: "space-zones",
      paint: {
        "fill-extrusion-color": ["get", "color"],
        "fill-extrusion-height": ["get", "height"],
        "fill-extrusion-opacity": 0.6,
      },
    });
    m.setLayoutProperty(
      "space-zone-volume",
      "visibility",
      a.view3D ? "visible" : "none",
    );
    layer({
      id: "space-route",
      type: "line",
      source: "space-routes",
      paint: {
        "line-color": scene.tone,
        "line-width": scene.id === "traffic" ? 6 : 2.5,
        "line-opacity": 0.65,
      },
    });
    layer({
      id: "space-zone-label",
      type: "symbol",
      source: "space-zones",
      layout: {
        "text-field": ["get", "name"],
        "text-font": ["Open Sans Semibold"],
        "text-size": 12,
        "text-max-width": 12,
      },
      paint: {
        "text-color": a.theme === "dark" ? "#f6faf3" : "#243329",
        "text-halo-color": a.theme === "dark" ? "#18241c" : "#fcfdfb",
        "text-halo-width": 2,
      },
    });
    layer({
      id: "space-sensor-halo",
      type: "circle",
      source: "space-sensors",
      paint: {
        "circle-color": ["get", "color"],
        "circle-radius": 16,
        "circle-opacity": 0.15,
      },
    });
    layer({
      id: "space-sensor",
      type: "circle",
      source: "space-sensors",
      paint: {
        "circle-color": ["get", "color"],
        "circle-radius": ["case", ["==", ["get", "selected"], 1], 8, 6],
        "circle-stroke-color": "#fcfdfb",
        "circle-stroke-width": 2,
      },
    });
    layer({
      id: "space-sensor-label",
      type: "symbol",
      source: "space-sensors",
      minzoom: 14,
      layout: {
        "text-field": ["get", "label"],
        "text-font": ["Open Sans Semibold"],
        "text-size": 11,
        "text-offset": [0, 1.7],
        "text-anchor": "top",
        "text-optional": true,
      },
      paint: {
        "text-color": a.theme === "dark" ? "#f6faf3" : "#243329",
        "text-halo-color": a.theme === "dark" ? "#18241c" : "#fcfdfb",
        "text-halo-width": 2,
      },
    });
    layer({
      id: "space-sensor-hit",
      type: "circle",
      source: "space-sensors",
      paint: {
        "circle-radius": 21,
        "circle-opacity": 0.001,
        "circle-color": scene.tone,
      },
    });
    layer({
      id: "space-vehicle",
      type: "circle",
      source: "space-vehicles",
      paint: {
        "circle-radius": scene.id === "traffic" ? 3.5 : 2.5,
        "circle-color": ["get", "color"],
        "circle-stroke-color": "#fcfdfb",
        "circle-stroke-width": 1,
      },
    });
    for (const id of ["space-zone-fill", "space-zone-line", "space-zone-label"])
      m.setLayoutProperty(id, "visibility", s.showZones ? "visible" : "none");
    m.setLayoutProperty(
      "space-zone-volume",
      "visibility",
      s.showZones && a.view3D ? "visible" : "none",
    );
    for (const id of ["space-zone-label", "space-sensor-label"]) {
      m.setPaintProperty(
        id,
        "text-color",
        a.theme === "dark" ? "#f6faf3" : "#243329",
      );
      m.setPaintProperty(
        id,
        "text-halo-color",
        a.theme === "dark" ? "#18241c" : "#fcfdfb",
      );
    }
    m.setPaintProperty("space-zone-fill", "fill-opacity", [
      "case",
      ["==", ["get", "id"], s.selectedId ?? ""],
      0.34,
      0.15,
    ]);
    m.setPaintProperty("space-zone-line", "line-width", [
      "case",
      ["==", ["get", "id"], s.selectedId ?? ""],
      3,
      1.2,
    ]);
    source("space-sensors", sensorData(scene, demoTime()));
    source("space-vehicles", vehicles(scene, demoTime()));
    lastSensors = 0;
    schedule();
  }
  function schedule() {
    const s = useExperienceStore.getState();
    if (
      !disposed &&
      !timer &&
      !frame &&
      s.activeId &&
      s.activeId !== "landslides" &&
      s.replayTime === null &&
      document.visibilityState !== "hidden"
    )
      frame = requestAnimationFrame(animation);
  }
  function animation(t: number) {
    frame = 0;
    if (disposed) return;
    const s = useExperienceStore.getState(),
      scene = experience(s.activeId);
    if (
      !ready ||
      !scene ||
      scene.id === "landslides" ||
      s.replayTime !== null ||
      document.visibilityState === "hidden"
    )
      return;
    const reduced =
        document.documentElement.dataset.motion === "reduced" ||
        window.matchMedia("(prefers-reduced-motion:reduce)").matches,
      at = demoTime();
    if (m.getSource("space-vehicles"))
      source("space-vehicles", vehicles(scene, at));
    if (t - lastSensors > 1000) {
      if (m.getSource("space-sensors"))
        source("space-sensors", sensorData(scene, at));
      updateHover(scene, at);
      lastSensors = t;
    }
    timer = setTimeout(
      () => {
        timer = null;
        schedule();
      },
      reduced || !s.showVehicles ? 1000 : 100,
    );
  }
  function visibility() {
    if (document.visibilityState === "hidden") {
      clearHover();
      if (timer) clearTimeout(timer);
      timer = null;
      cancelAnimationFrame(frame);
      frame = 0;
    } else {
      lastSensors = 0;
      sync();
      schedule();
    }
  }
  function click(e: MapMouseEvent) {
    const s = useExperienceStore.getState();
    if (useAppStore.getState().drawingMode || !s.activeId || isPointReadingClick(e)) return;
    if (s.activeId === "landslides") {
      if (s.probe) {
        consumeProbeClick(e);
        const geometry = polygonAt(
          [e.lngLat.lng, e.lngLat.lat],
          Array.from({ length: 40 }, (_, i) => [
            Math.cos((i / 40) * Math.PI * 2) * 600,
            Math.sin((i / 40) * Math.PI * 2) * 600,
          ]),
        );
        selectArea({
          id: `probe-${Date.now()}`,
          name: "Zona intorno al punto",
          geometry,
          saved: false,
        });
      }
      return;
    }
    const ids = [
      "space-sensor-hit",
      "space-route",
      "space-zone-fill",
      "space-boundary-fill",
    ].filter((id) => m.getLayer(id));
    if (!ids.length) return;
    const hits = m.queryRenderedFeatures(e.point, { layers: ids });
    const hit =
      hits.find((f) => f.layer.id === "space-sensor-hit") ??
      hits.find((f) => f.layer.id === "space-route") ??
      hits.find((f) => f.layer.id === "space-zone-fill");
    if (hit?.properties?.id) selectObject(String(hit.properties.id));
  }
  function move(e: MapMouseEvent) {
    if (useAppStore.getState().drawingMode) return;
    const s = useExperienceStore.getState();
    if (!s.activeId) return;
    if (s.probe) {
      m.getCanvas().style.cursor = "crosshair";
      return;
    }
    const scene = experience(s.activeId);
    if (!scene || scene.id === "landslides") return;
    const ids = ["space-sensor-hit", "space-route", "space-zone-fill"].filter(
      (id) => m.getLayer(id),
    );
    const hits = ids.length
      ? m.queryRenderedFeatures(e.point, { layers: ids })
      : [];
    m.getCanvas().style.cursor = hits.length ? "pointer" : "";
    const sensor = scene.sensors.find(
      (a) =>
        a.id ===
        hits.find((f) => f.layer.id === "space-sensor-hit")?.properties?.id,
    );
    const key = sensor?.id ?? "";
    if (key !== hovered) {
      popup?.remove();
      popup = null;
      hovered = key;
      if (sensor) {
        const v = reading(scene, sensor, demoTime(), s.scenario);
        popup = new maplibregl.Popup({
          closeButton: false,
          closeOnClick: false,
          offset: 16,
          maxWidth: "230px",
        })
          .setLngLat(sensor.coordinates)
          .setText(
            `${sensor.name} · ${v.value.toLocaleString("it-IT", { maximumFractionDigits: 1 })} ${sensor.unit} · simulato`,
          )
          .addTo(m);
      }
    }
  }
  const loaded = () => {
    ready = true;
    installed = null;
    sync();
  };
  const loading = () => {
    ready = false;
  };
  m.on("style.load", loaded);
  m.on("styledataloading", loading);
  m.on("click", click);
  m.on("mousemove", move);
  m.on("mouseout", clearHover);
  const unsub = useExperienceStore.subscribe(sync),
    unsubApp = useAppStore.subscribe(sync);
  sync();
  document.addEventListener("visibilitychange", visibility);
  schedule();
  return () => {
    disposed = true;
    cancelAnimationFrame(frame);
    if (timer) clearTimeout(timer);
    document.removeEventListener("visibilitychange", visibility);
    unsub();
    unsubApp();
    m.off("style.load", loaded);
    m.off("styledataloading", loading);
    m.off("click", click);
    m.off("mousemove", move);
    m.off("mouseout", clearHover);
    if (ready) remove();
    popup?.remove();
  };
}
