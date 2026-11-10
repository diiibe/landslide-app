import { isPointReadingClick } from "@/regional/pointReadings";
import type {
  Map as MLMap,
  GeoJSONSource,
  MapMouseEvent,
  ExpressionSpecification,
} from "maplibre-gl";
import { useAppStore } from "@/app/store";
import { useExperienceStore, selectObject } from "../store";
import { isNatureSpace } from "../types";
import { AIR_OBSERVATIONS, AIR_SITES, FIRE_DAYS, airValue } from "./fire";
import { CAMERAS, cameraOnline, captures, cameraSector } from "./wildlife";
import { useNatureStore, treeId, treeMatches, treeFamilyColor } from "./store";
const EMPTY: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};
const ids = [
  "nature-camera-tracks",
  "nature-camera-view",
  "nature-camera-ray",
  "nature-footprint",
  "nature-footprint-line",
  "nature-cluster",
  "nature-cluster-label",
  "nature-node",
  "nature-node-ring",
  "nature-label",
  "nature-hit",
];
const sources = [
  "nature-footprints",
  "nature-nodes",
  "nature-camera-tracks",
  "nature-camera-view",
];
export function natureNodes(now: number): GeoJSON.FeatureCollection {
  const s = useNatureStore.getState(),
    e = useExperienceStore.getState(),
    selected = e.selectedId;
  const point = (
    id: string,
    coordinates: number[],
    props: Record<string, unknown>,
  ): GeoJSON.Feature => ({
    type: "Feature",
    id,
    geometry: { type: "Point", coordinates },
    properties: {
      id,
      __featureId: id,
      natureSpace: e.activeId,
      selected: id === selected ? 1 : 0,
      ...props,
    },
  });
  if (e.activeId === "fire")
    return {
      type: "FeatureCollection",
      features: !s.showAir
        ? []
        : AIR_SITES.flatMap((site) => {
            const observations = AIR_OBSERVATIONS.filter(
              (o) => o.site === site.id && o.date === FIRE_DAYS[s.fireDay],
            );
            if (!observations.length) return [];
            const latest = observations[observations.length - 1]!;
            return [
              point(site.id, site.coordinates, {
                name: site.name,
                label:
                  observations
                    .map((o) => `${o.time} · ${airValue(o)}`)
                    .join(" / ") + " µg/m³",
                readingDetail: `ARPA FVG · ${FIRE_DAYS[s.fireDay]} · località indicativa`,
                color: "#e6a06f",
                radius: 5 + Math.sqrt(latest.high / 442) * 10,
              }),
            ];
          }),
    };
  if (e.activeId === "wildlife") {
    const events = captures(now);
    return {
      type: "FeatureCollection",
      features: CAMERAS.filter(
        (c) => s.camera === "all" || c.id === s.camera,
      ).map((c) => {
        const online = cameraOnline(c.id, now),
          latest = events.find((d) => d.camera === c.id);
        return point(c.id, c.coordinates, {
          name: c.name,
          label: `CAM ${c.name.slice(-2)} · ${online ? "attiva" : "pausa demo"}`,
          readingDetail: "Rete dimostrativa · nessuna telemetria reale",
          radius: 7,
          color: !online
            ? "#8e9a95"
            : latest && latest.confidence < s.threshold
              ? "#d6a75c"
              : "#88b699",
        });
      }),
    };
  }
  if (e.activeId === "park")
    return {
      type: "FeatureCollection",
      features: s.trees
        .filter((t) => treeMatches(t, s))
        .map((t) => {
          const id = treeId(t),
            condition = String(t.properties.stt_st ?? "Non indicato"),
            color =
              s.treeMode === "family"
                ? treeFamilyColor(t)
                : /instabil/i.test(condition)
                  ? "#d7a76b"
                  : /stabil|sicura/i.test(condition)
                    ? "#89b89d"
                    : "#a2a9ba";
          return point(id, t.geometry.coordinates, {
            name: `${t.properties.specie ?? "Specie non indicata"} · ${t.properties.prog ?? id}`,
            label: s.plan.includes(id)
              ? `Sopralluogo · ${t.properties.prog ?? id}`
              : String(t.properties.prog ?? id),
            readingDetail: `ERPAC · ${t.properties.familia ?? "Famiglia non indicata"} · rilievo ${String(t.properties.data_rilievo ?? "senza data").slice(0, 10)}`,
            radius: 5,
            color,
            planned: s.plan.includes(id) ? 1 : 0,
          });
        }),
    };
  return EMPTY;
}
export function mountNatureMap(m: MLMap) {
  let ready = !!m.isStyleLoaded(),
    disposed = false,
    installed: string | null = null,
    generation = 0,
    navigation = 0;
  let nodeKey = "",
    footprintKey: unknown = null,
    nodeTrees: unknown = null;
  const source = (
    id: string,
    data: GeoJSON.FeatureCollection,
    cluster = false,
  ) => {
    if (m.getSource(id)) (m.getSource(id) as GeoJSONSource).setData(data);
    else
      m.addSource(id, {
        type: "geojson",
        data,
        ...(cluster
          ? { cluster: true, clusterRadius: 36, clusterMaxZoom: 16 }
          : {}),
      });
  };
  function remove() {
    generation++;
    for (const id of [...ids].reverse()) if (m.getLayer(id)) m.removeLayer(id);
    for (const id of sources) if (m.getSource(id)) m.removeSource(id);
    installed = null;
    nodeKey = "";
    footprintKey = null;
  }
  function sync() {
    if (disposed || !ready) return;
    const e = useExperienceStore.getState(),
      s = useNatureStore.getState(),
      a = useAppStore.getState();
    if (installed !== e.activeId) remove();
    if (!isNatureSpace(e.activeId)) return;
    installed = e.activeId;
    const stateKey = JSON.stringify([
      e.activeId,
      e.selectedId,
      s.fireDay,
      s.showAir,
      s.camera,
      s.threshold,
      s.treeQuery,
      s.family,
      s.treeMode,
      s.plan,
      e.activeId === "wildlife" ? Math.floor(Date.now() / 30000) : 0,
    ]);
    const dataKey =
      stateKey + (e.activeId === "park" ? (s.treeRetrieved ?? "") : "");
    if (nodeKey !== dataKey || nodeTrees !== s.trees) {
      source("nature-nodes", natureNodes(Date.now()), e.activeId === "park");
      nodeKey = dataKey;
      nodeTrees = s.trees;
    }
    const footprints =
      e.activeId === "fire" && s.showPerimeters && s.fireData
        ? s.fireData
        : EMPTY;
    if (footprintKey !== footprints) {
      source("nature-footprints", footprints);
      footprintKey = footprints;
    }
    if (e.activeId === "wildlife") {
      if (!m.getSource("nature-camera-tracks"))
        m.addSource("nature-camera-tracks", {
          type: "geojson",
          data: `${import.meta.env.BASE_URL}data/spaces/nature/camera-tracks.geojson`,
          attribution:
            '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        });
      const camera = CAMERAS.find((c) => c.id === (e.selectedId ?? s.camera));
      source("nature-camera-view", {
        type: "FeatureCollection",
        features: camera ? [cameraSector(camera)] : [],
      });
      if (!m.getLayer("nature-camera-tracks")) {
        m.addLayer({
          id: "nature-camera-tracks",
          type: "line",
          source: "nature-camera-tracks",
          paint: {
            "line-color": "#b6ba93",
            "line-width": 1.5,
            "line-opacity": 0.7,
            "line-dasharray": [3, 2],
          },
        });
        m.addLayer({
          id: "nature-camera-view",
          type: "fill",
          source: "nature-camera-view",
          paint: { "fill-color": "#d5b77b", "fill-opacity": 0.28 },
        });
        m.addLayer({
          id: "nature-camera-ray",
          type: "line",
          source: "nature-camera-view",
          paint: { "line-color": "#e3c58b", "line-width": 1.5 },
        });
      }
    }
    if (!m.getLayer("nature-footprint")) {
      m.addLayer({
        id: "nature-footprint",
        type: "fill",
        source: "nature-footprints",
        paint: { "fill-color": "#d76845", "fill-opacity": 0.23 },
      });
      m.addLayer({
        id: "nature-footprint-line",
        type: "line",
        source: "nature-footprints",
        paint: { "line-color": "#e5946c", "line-width": 1.7 },
      });
      m.addLayer({
        id: "nature-cluster",
        type: "circle",
        source: "nature-nodes",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#537f68",
          "circle-radius": [
            "step",
            ["get", "point_count"],
            17,
            20,
            22,
            100,
            27,
          ],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#d8e7d9",
        },
      });
      m.addLayer({
        id: "nature-cluster-label",
        type: "symbol",
        source: "nature-nodes",
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["to-string", ["get", "point_count"]],
          "text-size": 12,
          "text-font": ["Open Sans Semibold"],
        },
        paint: { "text-color": "#f8faf5" },
      });
      m.addLayer({
        id: "nature-node-ring",
        type: "circle",
        source: "nature-nodes",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-radius": ["+", ["get", "radius"], 4],
          "circle-opacity": 0,
          "circle-stroke-width": [
            "case",
            ["==", ["get", "selected"], 1],
            3,
            ["==", ["get", "planned"], 1],
            2,
            0,
          ],
          "circle-stroke-color": "#f1d79e",
        },
      });
      m.addLayer({
        id: "nature-node",
        type: "circle",
        source: "nature-nodes",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-radius": ["get", "radius"],
          "circle-color": ["get", "color"],
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#e6eee7",
          "circle-opacity": 0.95,
        },
      });
      m.addLayer({
        id: "nature-label",
        type: "symbol",
        source: "nature-nodes",
        filter: ["!", ["has", "point_count"]],
        layout: {
          "text-field": ["get", "label"],
          "text-size": 11,
          "text-font": ["Open Sans Semibold"],
          "text-anchor": "top",
          "text-offset": [0, 1.7],
          "text-optional": true,
        },
        paint: {
          "text-color": "#eff6ed",
          "text-halo-color": "#1c2b22",
          "text-halo-width": 2,
        },
      });
      m.addLayer({
        id: "nature-hit",
        type: "circle",
        source: "nature-nodes",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-radius": 20,
          "circle-opacity": 0.001,
          "circle-color": "#e6eee7",
        },
      });
    }
    const filter: ExpressionSpecification =
      e.activeId === "park"
        ? [
            "all",
            ["!", ["has", "point_count"]],
            [
              "any",
              ["==", ["get", "selected"], 1],
              ["==", ["get", "planned"], 1],
            ],
          ]
        : ["!", ["has", "point_count"]];
    m.setFilter("nature-label", filter);
    m.setPaintProperty(
      "nature-label",
      "text-color",
      a.basemap === "light" || a.basemap === "outdoors" ? "#213b2b" : "#eff6ed",
    );
    m.setPaintProperty(
      "nature-label",
      "text-halo-color",
      a.basemap === "light" || a.basemap === "outdoors" ? "#f5f8ef" : "#1c2b22",
    );
  }
  async function click(ev: MapMouseEvent) {
    const e = useExperienceStore.getState();
    if (
      !isNatureSpace(e.activeId) ||
      useAppStore.getState().drawingMode ||
      isPointReadingClick(ev) ||
      !ready
    )
      return;
    const request = ++navigation;
    const hits = m.queryRenderedFeatures(ev.point, {
      layers: ["nature-hit", "nature-cluster", "nature-footprint"].filter(
        (id) => m.getLayer(id),
      ),
    });
    const point = hits.find((f) => f.layer.id === "nature-hit"),
      cluster = hits.find((f) => f.layer.id === "nature-cluster");
    if (point) {
      const id = String(point.properties.id);
      const coord =
        point.geometry.type === "Point" ? point.geometry.coordinates : null;
      const coincident = coord
        ? natureNodes(Date.now())
            .features.filter(
              (f) =>
                f.geometry.type === "Point" &&
                Math.abs(f.geometry.coordinates[0]! - coord[0]!) < 1e-7 &&
                Math.abs(f.geometry.coordinates[1]! - coord[1]!) < 1e-7,
            )
            .map((f) => String(f.properties?.id))
        : [id];
      useNatureStore.setState({ coincidentIds: coincident });
      selectObject(id);
      return;
    }
    if (cluster && cluster.geometry.type === "Point") {
      const source = m.getSource("nature-nodes") as GeoJSONSource,
        epoch = generation;
      try {
        const zoom = await source.getClusterExpansionZoom(
          Number(cluster.properties.cluster_id),
        );
        if (
          !disposed &&
          ready &&
          epoch === generation &&
          request === navigation &&
          m.getSource("nature-nodes") === source &&
          useExperienceStore.getState().activeId === e.activeId
        )
          m.easeTo({
            center: cluster.geometry.coordinates as [number, number],
            zoom: Math.min(18, zoom + 0.15),
            duration:
              document.documentElement.dataset.motion === "reduced" ? 0 : 350,
          });
      } catch {
        /* A style transition can remove a cluster source. */
      }
      return;
    }
    const polys = [
      ...new Map(
        hits
          .filter((f) => f.layer.id === "nature-footprint")
          .map((f) => [String(f.properties.id), f]),
      ).keys(),
    ];
    if (polys.length) {
      useNatureStore.setState({
        coincidentIds: polys.map((id) => `fire-${id}`),
      });
      selectObject(`fire-${polys[0]}`);
    }
  }
  function move(ev: MapMouseEvent) {
    if (
      !isNatureSpace(useExperienceStore.getState().activeId) ||
      useAppStore.getState().drawingMode ||
      !ready
    )
      return;
    const layers = ["nature-hit", "nature-cluster", "nature-footprint"].filter(
      (id) => m.getLayer(id),
    );
    m.getCanvas().style.cursor =
      layers.length && m.queryRenderedFeatures(ev.point, { layers }).length
        ? "pointer"
        : "";
  }
  const load = () => {
      ready = true;
      installed = null;
      sync();
    },
    loading = () => {
      ready = false;
      generation++;
    };
  m.on("style.load", load);
  m.on("styledataloading", loading);
  m.on("click", click);
  m.on("mousemove", move);
  const unsub = useNatureStore.subscribe(sync),
    unsubExperience = useExperienceStore.subscribe(sync),
    unsubApp = useAppStore.subscribe(sync);
  const visibility = () => {
    if (document.visibilityState !== "hidden") sync();
  };
  document.addEventListener("visibilitychange", visibility);
  const timer = setInterval(() => {
    if (
      useExperienceStore.getState().activeId === "wildlife" &&
      document.visibilityState !== "hidden"
    )
      sync();
  }, 30000);
  sync();
  return () => {
    disposed = true;
    clearInterval(timer);
    unsub();
    unsubExperience();
    unsubApp();
    document.removeEventListener("visibilitychange", visibility);
    m.off("style.load", load);
    m.off("styledataloading", loading);
    m.off("click", click);
    m.off("mousemove", move);
    if (ready) remove();
  };
}
