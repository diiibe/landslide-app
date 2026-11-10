import {
  Popup,
  type Map as MLMap,
  type GeoJSONSource,
  type MapMouseEvent,
} from "maplibre-gl";
import { useAppStore } from "@/app/store";
import { useTwinStore } from "@/digital-twin/store";
import { formatTime, formatValue } from "@/digital-twin/data";
import { directionIcon, DIRECTION_IMAGE } from "./directionIcon";
import { defaultOpacity, mapLabelData } from "./data";
import { presentation } from "./presentation";
import { regionalStyle, layerSuffixes, OVERVIEW_ZOOM } from "./mapStyle";
import { useAppearance } from "@/ui/appearance";
import { layerURL, patchEntry, useRegionalStore } from "./store";
import { pickDataFeature } from "./mapPicking";
import { hasPointReadings, isPointReadingClick } from "./pointReadings";
import { isProbeClick } from "@/spaces/interactions";
import type { LayerDefinition } from "./types";
const prefix = (id: string) => "regional-" + id;
const EMPTY: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};
export function mountRegionalMap(map: MLMap): () => void {
  let ready = false,
    disposed = false,
    popup: Popup | null = null,
    hoverId = "",
    lastHover = 0;
  const rasterVersions = new Map<string, string>();
  const configurations = new Map<string, string>();
  const installed = new Map<string, LayerDefinition>(),
    dataRefs = new Map<string, unknown>();
  function hideHover() {
    popup?.remove();
    popup = null;
    hoverId = "";
  }
  function remove(id: string) {
    const src = prefix(id);
    for (const suffix of layerSuffixes)
      if (map.getLayer(src + "-" + suffix)) map.removeLayer(src + "-" + suffix);
    if (map.getSource(src)) map.removeSource(src);
    if (map.getSource(src + "-overview-source")) map.removeSource(src + "-overview-source");
    configurations.delete(id);
    installed.delete(id);
    rasterVersions.delete(id);
    dataRefs.delete(id);
  }
  function sync() {
    if (!ready || disposed) return;
    const s = useRegionalStore.getState(),
      layers = s.catalog?.layers ?? [];
    for (const id of [...installed.keys()])
      if (
        !s.enabled[id] ||
        !layers.some((l) => l.id === id && l.status === "ready")
      )
        remove(id);
    const fontLayer = map.getStyle().layers.find((l) => l.type === "symbol" && Array.isArray(l.layout?.["text-font"]) && l.layout["text-font"].every((f) => typeof f === "string"));
    const fonts = fontLayer?.type === "symbol" ? fontLayer.layout?.["text-font"] as string[] : ["Open Sans Semibold"];
    const before = map
      .getStyle()
      .layers.find(
        (l) => l.id.startsWith("twin-sensors") || l.id === "twin-aia",
      )?.id;
    for (const l of layers) {
      if (
        !s.enabled[l.id] ||
        l.status !== "ready" ||
        !l.kind ||
        ["pcr", "radar", "aia"].includes(l.kind)
      )
        continue;
      const src = prefix(l.id),
        entry = s.entries[l.id],
        opacity = s.opacity[l.id] ?? defaultOpacity(l);
      const old = installed.get(l.id);
      const mode = s.display[l.id] === "density" && !presentation(l).density ? "auto" : s.display[l.id] ?? "auto", config = JSON.stringify([mode, l.overview, l.count, l.generatedAt, l.overview ? l.retrievedAt : null]);
      if (
        old &&
        (configurations.get(l.id) !== config || old.kind !== l.kind ||
          (old.retrievedAt !== l.retrievedAt && l.kind !== "geojson") ||
          (l.kind === "raster" &&
            rasterVersions.get(l.id) !== s.catalog?.generatedAt))
      )
        remove(l.id);
      if (l.kind === "geojson" && !entry?.data) continue;
      if (!map.getSource(src)) {
        if (l.kind === "buildings") map.addSource(src, { type: "geojson", data: EMPTY });
        else if (l.kind === "geojson")
          map.addSource(src, {
            type: "geojson",
            data: mapLabelData(l, entry!.data!),
            promoteId: "__featureId",
            ...(presentation(l).clustered && mode === "auto" ? { cluster: true, clusterRadius: 46, clusterMaxZoom: 12 } : {}),
          });
        else if (l.kind === "vector" && l.file)
          map.addSource(src, {
            type: "vector",
            url:
              "pmtiles://" +
              layerURL(l.file) +
              "?v=" +
              encodeURIComponent(l.generatedAt ?? l.retrievedAt ?? ""),
            promoteId: "__featureId",
          });
        else if (l.kind === "raster" && l.tiles)
          map.addSource(src, {
            type: "raster",
            tiles: l.tiles.map((url) =>
              url.startsWith("http")
                ? url
                : new URL(
                    import.meta.env.BASE_URL + url,
                    window.location.href,
                  ).href
                    .replace(/%7B/gi, "{")
                    .replace(/%7D/gi, "}") +
                  "?v=" +
                  encodeURIComponent(s.catalog?.generatedAt ?? ""),
            ),
            tileSize: 512,
            minzoom: l.minzoom ?? 0,
            maxzoom: l.maxzoom ?? 18,
            ...(l.bounds
              ? {
                  bounds: [...l.bounds[0], ...l.bounds[1]] as [
                    number,
                    number,
                    number,
                    number,
                  ],
                }
              : {}),
          });
        else continue;
        installed.set(l.id, l);
        configurations.set(l.id, config);
        if (l.kind === "raster")
          rasterVersions.set(l.id, s.catalog!.generatedAt);
        dataRefs.set(l.id, entry?.data);
      } else if (
        l.kind === "geojson" &&
        entry?.data &&
        dataRefs.get(l.id) !== entry.data
      ) {
        (map.getSource(src) as GeoJSONSource).setData(mapLabelData(l, entry.data));
        dataRefs.set(l.id, entry.data);
      }
      if (l.kind === "raster") {
        const id = src + "-fill";
        if (!map.getLayer(id))
          map.addLayer(
            {
              id,
              type: "raster",
              source: src,
              paint: { "raster-opacity": opacity },
            },
            map
              .getStyle()
              .layers.find(
                (layer) =>
                  layer.type === "symbol" ||
                  layer.id.startsWith("susceptibility") ||
                  layer.id.startsWith("cells-"),
              )?.id,
          );
        else map.setPaintProperty(id, "raster-opacity", opacity);
        continue;
      }
      if (l.overview && mode !== "points" && !map.getSource(src + "-overview-source"))
        map.addSource(src + "-overview-source", { type: "geojson", ...(mode === "auto" ? { cluster: true, clusterRadius: 56, clusterMaxZoom: (l.overview.detailZoom ?? OVERVIEW_ZOOM) - 1, clusterProperties: { __count: ["+", ["get", "__count"]] } } : {}), data: layerURL(l.overview.file) + "?v=" + encodeURIComponent(l.generatedAt ?? l.retrievedAt ?? ""), maxzoom: l.overview.detailZoom ?? OVERVIEW_ZOOM });
      if (presentation(l).type === "direction" && !map.hasImage(DIRECTION_IMAGE)) map.addImage(DIRECTION_IMAGE, directionIcon());
      const desired = regionalStyle(l, opacity, mode, fonts, entry?.data, s.filters[l.id]);
      const ids = new Set(desired.map((style) => style.id));
      for (const suffix of layerSuffixes) if (!ids.has(src + "-" + suffix) && map.getLayer(src + "-" + suffix)) map.removeLayer(src + "-" + suffix);
      for (const style of desired) {
        if (!map.getLayer(style.id)) map.addLayer(style, before);
        else {
          if ("filter" in style && style.filter) map.setFilter(style.id, style.filter);
          for (const [key, value] of Object.entries(style.paint ?? {})) map.setPaintProperty(style.id, key, value);
        }
      }
    }
    const selected =
      s.selection && s.enabled[s.selection.layerId] ? s.selection : null;
    let selectedData: GeoJSON.FeatureCollection = EMPTY;
    if (selected && s.enabled[selected.layerId])
      selectedData = {
        type: "FeatureCollection",
        features: [selected.feature],
      };
    if (!map.getSource("regional-selection"))
      map.addSource("regional-selection", {
        type: "geojson",
        data: selectedData,
      });
    else if (dataRefs.get("selection") !== selected) {
      (map.getSource("regional-selection") as GeoJSONSource).setData(
        selectedData,
      );
    }
    dataRefs.set("selection", selected);
    if (!map.getLayer("regional-selection-shadow")) map.addLayer({ id:"regional-selection-shadow", type:"line", source:"regional-selection", filter:["in",["geometry-type"],["literal",["Polygon","MultiPolygon","LineString","MultiLineString"]]], paint:{"line-color":"#172d25","line-width":7} });
    if (!map.getLayer("regional-selection-point-shadow")) map.addLayer({ id:"regional-selection-point-shadow", type:"circle", source:"regional-selection", filter:["==",["geometry-type"],"Point"], paint:{"circle-radius":12,"circle-opacity":0,"circle-stroke-width":6,"circle-stroke-color":"#172d25"} });
    if (!map.getLayer("regional-selection-line"))
      map.addLayer({
        id: "regional-selection-line",
        type: "line",
        source: "regional-selection",
        filter: [
          "in",
          ["geometry-type"],
          [
            "literal",
            ["Polygon", "MultiPolygon", "LineString", "MultiLineString"],
          ],
        ],
        paint: { "line-color": "#f5ecd8", "line-width": 4 },
      });
    if (!map.getLayer("regional-selection-point"))
      map.addLayer({
        id: "regional-selection-point",
        type: "circle",
        source: "regional-selection",
        filter: ["==", ["geometry-type"], "Point"],
        paint: {
          "circle-radius": 12,
          "circle-opacity": 0,
          "circle-stroke-width": 3,
          "circle-stroke-color": "#f5ecd8",
        },
      });
  }
  function selectionHit(e: MapMouseEvent, radius: number) {
    const hit = pickDataFeature(map, e.point, radius);
    map.getCanvas().style.cursor = hit ? "pointer" : "";
    return hit?.layer.id.startsWith("regional-") &&
      !hit.layer.id.startsWith("regional-selection")
      ? hit
      : undefined;
  }
  function clicked(e: MapMouseEvent) {
    if (isPointReadingClick(e)) { hideHover(); return; }
    if (!ready || disposed || useAppStore.getState().drawingMode || isProbeClick(e)) return;
    const hit = selectionHit(
      e,
      window.matchMedia("(pointer: coarse)").matches ? 22 : 8,
    );
    if (!hit) return;
    const layer = [...installed.values()].find((l) =>
      hit.layer.id.startsWith(prefix(l.id) + "-"),
    );
    if (!layer) return;
    const properties = hit.properties ?? {};
    const animate = useAppearance.getState().motion && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (properties.__overview) {
      if (hit.geometry.type === "Point") map.easeTo({
        center: hit.geometry.coordinates.slice(0, 2) as [number, number],
        zoom: Math.min(15, Math.max(map.getZoom() + 1.8, (layer.overview?.detailZoom ?? OVERVIEW_ZOOM) + .75)),
        pitch: 0,
        duration: animate ? 450 : 0,
      });
      hideHover();
      return;
    }
    if (properties.cluster && typeof properties.cluster_id === "number" && hit.geometry.type === "Point") {
      const sourceId = prefix(layer.id) + (hit.layer.id.includes("-overview") ? "-overview-source" : "");
      const source = map.getSource(sourceId) as GeoJSONSource;
      const coordinates = hit.geometry.coordinates.slice(0, 2) as [number, number];
      void source.getClusterExpansionZoom(properties.cluster_id).then((zoom) => {
        if (ready && !disposed && map.getSource(sourceId) === source)
          map.easeTo({ center: coordinates, zoom: Math.min(16, zoom + .1), duration: animate ? 400 : 0 });
      }).catch(() => { /* Data may refresh while expanding a cluster. */ });
      hideHover();
      return;
    }
    hideHover();
    useTwinStore.setState({ selection: null });
    useRegionalStore.setState({
      selection: {
        layerId: layer.id,
        feature: {
          type: "Feature",
          id: hit.id,
          geometry: hit.geometry,
          properties: { ...hit.properties },
        },
      },
      detailId: layer.id,
      tab: "layers",
    });
    useAppStore.setState({ drawerOpen: true });
  }
  function hovered(e: MapMouseEvent) {
    if (hasPointReadings(map)) { hideHover(); return; }
    if (
      !ready ||
      disposed ||
      useAppStore.getState().drawingMode ||
      map.isMoving() ||
      performance.now() - lastHover < 48
    )
      return;
    lastHover = performance.now();
    const hit = selectionHit(e, 8);
    if (!hit) {
      hideHover();
      return;
    }
    const key =
      hit.layer.id + ":" + String(hit.properties?.__featureId ?? hit.properties?.cluster_id ?? hit.properties?.__bounds ?? hit.id) + ":" + String(hit.properties?.__count ?? hit.properties?.point_count ?? hit.properties?.__displayValue) + ":" + String(hit.properties?.__observedAt ?? "");
    if (key === hoverId && popup) {
      popup.setLngLat(e.lngLat);
      return;
    }
    hoverId = key;
    const node = document.createElement("div"),
      name = document.createElement("strong"),
      p = hit.properties ?? {};
    name.textContent = p.cluster || p.__overview ? `${String(p.__count ?? p.point_count)} ${p.__overview ? "record nella panoramica" : "elementi nel gruppo"}` : String(p.__name ?? "Elemento territoriale");
    node.append(name);
    const detail = document.createElement("div");
    detail.textContent = p.cluster || p.__overview ? "Tocca per avvicinarti e leggere i singoli elementi" : [
      p.__displayValue ??
        (typeof p.__value === "number" ? formatValue(p.__value) : ""),
      p.__unit ?? "",
      p.__depth ? `Profondità ${String(p.__depth)} m` : null,
      p.__observedAt ? formatTime(Date.parse(String(p.__observedAt))) : "",
    ]
      .filter(Boolean)
      .join(" · ");
    node.append(detail);
    if (!popup)
      popup = new Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 16,
        maxWidth: "280px",
      })
        .setLngLat(e.lngLat)
        .setDOMContent(node)
        .addTo(map);
    else popup.setLngLat(e.lngLat).setDOMContent(node);
  }
  function style() {
    ready = true;
    installed.clear();
    configurations.clear();
    rasterVersions.clear();
    dataRefs.clear();
    sync();
  }
  function loading() {
    ready = false;
    hideHover();
  }
  function errors(e: { sourceId?: string; error?: Error }) {
    if (!e.sourceId) return;
    const l = [...installed.values()].find((l) => prefix(l.id) === e.sourceId);
    if (l)
      patchEntry(l.id, {
        loading: false,
        error: e.error?.message ?? "Tile della fonte non disponibile",
      });
  }
  map.on("style.load", style);
  map.on("styledataloading", loading);
  map.on("click", clicked);
  map.on("mousemove", hovered);
  map.on("mouseout", hideHover);
  map.on("error", errors);
  const unsub = useRegionalStore.subscribe((s, p) => {
    if (
      s.catalog !== p.catalog ||
      s.enabled !== p.enabled ||
      s.entries !== p.entries ||
      s.opacity !== p.opacity ||
      s.filters !== p.filters ||
      s.display !== p.display ||
      s.selection !== p.selection
    )
      sync();
  });
  return () => {
    disposed = true;
    unsub();
    hideHover();
    map.off("style.load", style);
    map.off("styledataloading", loading);
    map.off("click", clicked);
    map.off("mousemove", hovered);
    map.off("mouseout", hideHover);
    map.off("error", errors);
  };
}
