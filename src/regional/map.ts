import {
  Popup,
  type Map as MLMap,
  type GeoJSONSource,
  type MapMouseEvent,
  type ExpressionSpecification,
} from "maplibre-gl";
import { useAppStore } from "@/app/store";
import { useTwinStore } from "@/digital-twin/store";
import { formatTime, formatValue } from "@/digital-twin/data";
import { metricRange, defaultOpacity } from "./data";
import { layerURL, patchEntry, useRegionalStore } from "./store";
import { pickDataFeature } from "./mapPicking";
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
  const installed = new Map<string, LayerDefinition>(),
    dataRefs = new Map<string, unknown>();
  function hideHover() {
    popup?.remove();
    popup = null;
    hoverId = "";
  }
  function remove(id: string) {
    const src = prefix(id);
    for (const suffix of ["fill", "line", "point"])
      if (map.getLayer(src + "-" + suffix)) map.removeLayer(src + "-" + suffix);
    if (map.getSource(src)) map.removeSource(src);
    installed.delete(id);
    dataRefs.delete(id);
  }
  function color(l: LayerDefinition): string | ExpressionSpecification {
    const range = metricRange(
      l,
      useRegionalStore.getState().entries[l.id]?.data,
    );
    if (!l.metric) return l.color;
    if (!range)
      return [
        "case",
        [
          "any",
          ["==", ["get", "__invalidTime"], true],
          ["==", ["get", "qualita_qc"], 4],
          ["==", ["get", "qualita_qc"], 3],
          ["!=", ["typeof", ["get", l.metric.field]], "number"],
        ],
        "#8c938b",
        l.color,
      ];
    const field = l.metric.field;
    return [
      "case",
      [
        "any",
        ["==", ["get", "__invalidTime"], true],
        ["==", ["get", "qualita_qc"], 4],
        ["==", ["get", "qualita_qc"], 3],
        ["!=", ["typeof", ["get", field]], "number"],
      ],
      "#8c938b",
      [
        "interpolate",
        ["linear"],
        ["get", field],
        range[0],
        "#deded0",
        (range[0] + range[1]) / 2,
        l.color,
        range[1],
        "#3b534c",
      ],
    ];
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
        ["pcr", "radar", "buildings", "aia"].includes(l.kind)
      )
        continue;
      const src = prefix(l.id),
        entry = s.entries[l.id],
        opacity = s.opacity[l.id] ?? defaultOpacity(l);
      const old = installed.get(l.id);
      if (
        old &&
        (old.kind !== l.kind ||
          (old.retrievedAt !== l.retrievedAt && l.kind !== "geojson"))
      )
        remove(l.id);
      if (l.kind === "geojson" && !entry?.data) continue;
      if (!map.getSource(src)) {
        if (l.kind === "geojson")
          map.addSource(src, {
            type: "geojson",
            data: entry!.data!,
            promoteId: "__featureId",
          });
        else if (l.kind === "vector" && l.file)
          map.addSource(src, {
            type: "vector",
            url:
              "pmtiles://" +
              layerURL(l.file) +
              "?v=" +
              encodeURIComponent(l.retrievedAt ?? ""),
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
                    .replace(/%7D/gi, "}"),
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
        dataRefs.set(l.id, entry?.data);
      } else if (
        l.kind === "geojson" &&
        entry?.data &&
        dataRefs.get(l.id) !== entry.data
      ) {
        (map.getSource(src) as GeoJSONSource).setData(entry.data);
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
      const sourceLayer =
        l.kind === "vector" ? { "source-layer": l.sourceLayer ?? "data" } : {};
      const slice = s.filters[l.id];
      const sliceFilter: ExpressionSpecification | undefined = slice
        ? ["==", ["to-string", ["get", "__depth"]], slice]
        : undefined;
      const filter = (types: string[]): ExpressionSpecification => [
        "all",
        ["match", ["geometry-type"], types, true, false],
        ...(sliceFilter ? [sliceFilter] : []),
      ];
      const paintColor = color(l);
      for (const suffix of ["fill", "line", "point"] as const) {
        const id = src + "-" + suffix;
        if (!map.getLayer(id)) {
          if (suffix === "fill")
            map.addLayer(
              {
                id,
                type: "fill",
                source: src,
                ...sourceLayer,
                filter: filter(["Polygon", "MultiPolygon"]),
                paint: { "fill-color": paintColor, "fill-opacity": opacity },
              },
              before,
            );
          if (suffix === "line")
            map.addLayer(
              {
                id,
                type: "line",
                source: src,
                ...sourceLayer,
                filter: filter([
                  "LineString",
                  "MultiLineString",
                  "Polygon",
                  "MultiPolygon",
                ]),
                paint: {
                  "line-color": l.color,
                  "line-width": 1.5,
                  "line-opacity": opacity,
                },
              },
              before,
            );
          if (suffix === "point")
            map.addLayer(
              {
                id,
                type: "circle",
                source: src,
                ...sourceLayer,
                filter: filter(["Point", "MultiPoint"]),
                paint: {
                  "circle-color": paintColor,
                  "circle-radius": [
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    5,
                    3,
                    13,
                    6,
                  ],
                  "circle-opacity": opacity,
                  "circle-stroke-color": "#202a25",
                  "circle-stroke-width": 1,
                },
              },
              before,
            );
        } else {
          map.setFilter(
            id,
            filter(
              suffix === "fill"
                ? ["Polygon", "MultiPolygon"]
                : suffix === "line"
                  ? ["LineString", "MultiLineString", "Polygon", "MultiPolygon"]
                  : ["Point", "MultiPoint"],
            ),
          );
          map.setPaintProperty(
            id,
            suffix === "fill"
              ? "fill-opacity"
              : suffix === "line"
                ? "line-opacity"
                : "circle-opacity",
            opacity,
          );
          if (suffix !== "line")
            map.setPaintProperty(
              id,
              suffix === "fill" ? "fill-color" : "circle-color",
              paintColor,
            );
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
    if (!ready || disposed || useAppStore.getState().drawingMode) return;
    const hit = selectionHit(
      e,
      window.matchMedia("(pointer: coarse)").matches ? 22 : 8,
    );
    if (!hit) return;
    const layer = [...installed.values()].find((l) =>
      hit.layer.id.startsWith(prefix(l.id) + "-"),
    );
    if (!layer) return;
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
    if (
      !ready ||
      disposed ||
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
      hit.layer.id + ":" + String(hit.properties?.__featureId ?? hit.id);
    if (key === hoverId && popup) {
      popup.setLngLat(e.lngLat);
      return;
    }
    hoverId = key;
    const node = document.createElement("div"),
      name = document.createElement("strong"),
      p = hit.properties ?? {};
    name.textContent = String(p.__name ?? "Elemento territoriale");
    node.append(name);
    const detail = document.createElement("div");
    detail.textContent = [
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
