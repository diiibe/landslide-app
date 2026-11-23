import {
  Popup,
  type ExpressionSpecification,
  type GeoJSONSource,
  type LayerSpecification,
  type Map as MLMap,
  type MapGeoJSONFeature,
  type MapMouseEvent,
} from "maplibre-gl";
import { useAppStore } from "@/app/store";
import { createHoverCard } from "@/map/hoverCard";
import {
  hasPointReadings,
  isPointReadingClick,
} from "@/regional/pointReadings";
import { useExperienceStore } from "../store";
import {
  aggregate,
  AIR_BASE,
  AIA_COLORS,
  aiaGroups,
  filteredAia,
  fmt,
  inventoryDomain,
  MEASURE_NAMES,
  PALETTE,
  read,
  stackSite,
  stationDomain,
  stationTone,
} from "./model";
import { selectAir, useAirStore } from "./store";
import { sampleSoil } from "./soil";
import type { AirLayer } from "./types";
const EMPTY: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};
const SOURCES = [
  "air-world",
  "air-corine",
  "air-inventory",
  "air-industrial",
  "air-commercial",
  "air-aia",
  "air-stations",
  "air-stack",
];
const LAYERS = [
  "air-world-raster",
  "air-corine-raster",
  "air-inventory-fill",
  "air-inventory-3d",
  "air-inventory-line",
  "air-industrial-fill",
  "air-industrial-line",
  "air-commercial-fill",
  "air-commercial-line",
  "air-aia-heat",
  "air-aia-point",
  "air-station-point",
  "air-stack-point",
  "air-station-label",
  "air-stack-label",
];
export function mountAirMap(map: MLMap) {
  let ready = map.isStyleLoaded(),
    disposed = false,
    generation = 0;
  const cache = new Map<
    string,
    { data: GeoJSON.FeatureCollection; signature: string }
  >();
  let inventoryCache: {
    data: unknown;
    poll: string;
    sector: string;
    features: GeoJSON.FeatureCollection;
  } | null = null;
  let popup: Popup | null = null;
  const clearHover = () => {
    popup?.remove();
    popup = null;
  };
  function source(id: string, data: GeoJSON.FeatureCollection) {
    const current = map.getSource(id) as GeoJSONSource | undefined,
      old = cache.get(id);
    if (current && old?.data === data) return;
    const signature = JSON.stringify(data);
    if (!current) {
      map.addSource(id, { type: "geojson", data });
      cache.set(id, { data, signature });
    } else if (old?.signature !== signature) {
      current.setData(data);
      cache.set(id, { data, signature });
    } else cache.set(id, { data, signature });
  }
  const layer = (spec: LayerSpecification) => {
    if (!map.getLayer(spec.id)) map.addLayer(spec);
  };
  const visible = (id: string, on: boolean) => {
    if (map.getLayer(id))
      map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
  };
  function remove() {
    clearHover();
    generation++;
    for (const id of [...LAYERS].reverse())
      if (map.getLayer(id)) map.removeLayer(id);
    for (const id of SOURCES) if (map.getSource(id)) map.removeSource(id);
    cache.clear();
  }
  function sync() {
    clearHover();
    if (disposed || !ready) return;
    const s = useAirStore.getState(),
      data = s.data;
    if (useExperienceStore.getState().activeId !== "air" || !data) {
      remove();
      return;
    }
    const on = (k: AirLayer) => s.layers[k],
      opacity = (k: AirLayer) => s.opacity[k],
      max = inventoryDomain(data, s.poll),
      color: ExpressionSpecification = [
        "case",
        ["<", ["get", "value"], 0],
        "#bec5bb",
        [
          "interpolate",
          ["linear"],
          ["get", "value"],
          0,
          PALETTE[0]!,
          max * 0.08,
          PALETTE[1]!,
          max * 0.25,
          PALETTE[2]!,
          max * 0.55,
          PALETTE[3]!,
          max,
          PALETTE[4]!,
        ],
      ];
    if (s.world && !map.getSource("air-world"))
      map.addSource("air-world", {
        type: "raster",
        tiles: [AIR_BASE + "worldcover/{z}/{x}/{y}.png"],
        tileSize: s.world.tileSize,
        minzoom: s.world.minzoom,
        maxzoom: s.world.maxzoom,
        bounds: s.world.bounds,
        attribution:
          '© <a href="https://esa-worldcover.org/en/data-access">ESA WorldCover 2021 / Contains modified Copernicus Sentinel data (2021)</a>',
      });
    if (map.getSource("air-world")) {
      layer({
        id: "air-world-raster",
        type: "raster",
        source: "air-world",
        paint: {
          "raster-opacity": opacity("world"),
          "raster-resampling": "nearest",
          "raster-fade-duration": 150,
        },
      });
      map.setPaintProperty(
        "air-world-raster",
        "raster-opacity",
        opacity("world"),
      );
      visible("air-world-raster", on("world"));
    }
    if (s.layers.corine && !map.getSource("air-corine"))
      map.addSource("air-corine", {
        type: "raster",
        tiles: [
          "https://image.discomap.eea.europa.eu/arcgis/rest/services/Corine/CLC2018_WM/MapServer/export?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=512,512&format=png32&transparent=true&layers=show:0,1&f=image",
        ],
        tileSize: 512,
        minzoom: 7,
        maxzoom: 13,
        bounds: [12.25, 45.55, 13.02, 46.65],
        attribution:
          "© Copernicus Land Monitoring Service / EEA · CORINE 2018",
      });
    if (map.getSource("air-corine")) {
      layer({
        id: "air-corine-raster",
        type: "raster",
        source: "air-corine",
        paint: {
          "raster-opacity": opacity("corine"),
          "raster-resampling": "nearest",
        },
      });
      map.setPaintProperty(
        "air-corine-raster",
        "raster-opacity",
        opacity("corine"),
      );
      visible("air-corine-raster", on("corine"));
    }
    const inventory: GeoJSON.FeatureCollection =
      inventoryCache?.data === data &&
      inventoryCache.poll === s.poll &&
      inventoryCache.sector === s.sector
        ? inventoryCache.features
        : {
            type: "FeatureCollection",
            features: data.municipalities.features.map((f) => {
              const v = aggregate(f, s.poll, s.sector).value;
              return {
                ...f,
                properties: {
                  istat: String(f.properties.istat),
                  name: f.properties.name,
                  value: v ?? -1,
                  height: v === null ? 0 : (v / max) * 1500,
                },
              };
            }),
          };
    inventoryCache = {
      data,
      poll: s.poll,
      sector: s.sector,
      features: inventory,
    };
    source("air-inventory", inventory);
    const three = useAppStore.getState().view3D;
    layer({
      id: "air-inventory-fill",
      type: "fill",
      source: "air-inventory",
      paint: { "fill-color": color, "fill-opacity": opacity("inventory") },
    });
    layer({
      id: "air-inventory-3d",
      type: "fill-extrusion",
      source: "air-inventory",
      paint: {
        "fill-extrusion-color": color,
        "fill-extrusion-height": ["get", "height"],
        "fill-extrusion-opacity": opacity("inventory"),
      },
    });
    layer({
      id: "air-inventory-line",
      type: "line",
      source: "air-inventory",
      paint: {
        "line-color": "#9c622e",
        "line-width": [
          "case",
          ["==", ["get", "istat"], s.municipalityId],
          2,
          0.4,
        ],
        "line-opacity": opacity("inventory"),
      },
    });
    map.setPaintProperty("air-inventory-fill", "fill-color", color);
    map.setPaintProperty(
      "air-inventory-fill",
      "fill-opacity",
      three ? opacity("inventory") * 0.45 : opacity("inventory"),
    );
    map.setPaintProperty("air-inventory-3d", "fill-extrusion-color", color);
    map.setPaintProperty(
      "air-inventory-3d",
      "fill-extrusion-opacity",
      opacity("inventory"),
    );
    map.setPaintProperty(
      "air-inventory-line",
      "line-opacity",
      opacity("inventory"),
    );
    map.setPaintProperty("air-inventory-line", "line-width", [
      "case",
      ["==", ["get", "istat"], s.municipalityId],
      2,
      0.4,
    ]);
    visible("air-inventory-fill", on("inventory"));
    visible("air-inventory-line", on("inventory"));
    visible("air-inventory-3d", on("inventory") && three);
    for (const [k, c] of [
      ["industrial", "#77528e"],
      ["commercial", "#bd7d48"],
    ] as const) {
      source(
        "air-" + k,
        s.context
          ? k === "industrial"
            ? s.context.industrialZones
            : s.context.commercialZones
          : EMPTY,
      );
      layer({
        id: `air-${k}-fill`,
        type: "fill",
        source: "air-" + k,
        paint: { "fill-color": c, "fill-opacity": opacity(k) },
      });
      layer({
        id: `air-${k}-line`,
        type: "line",
        source: "air-" + k,
        paint: {
          "line-color": c,
          "line-width": 1.2,
          "line-opacity": opacity(k),
        },
      });
      map.setPaintProperty(`air-${k}-fill`, "fill-opacity", opacity(k));
      map.setPaintProperty(`air-${k}-line`, "line-opacity", opacity(k));
      visible(`air-${k}-fill`, on(k));
      visible(`air-${k}-line`, on(k));
    }
    source("air-aia", {
      type: "FeatureCollection",
      features: filteredAia(
        data,
        s.aiaCategory,
        s.aiaQuery,
        s.aiaMunicipality,
      ).map((f) => ({
        ...f,
        properties: {
          ...f.properties,
          airKind: "aia",
          __featureId: f.properties.id,
          color:
            AIA_COLORS[
              s.aiaCategory === "all" ? aiaGroups(f)[0]! : s.aiaCategory
            ],
        },
      })),
    });
    layer({
      id: "air-aia-heat",
      type: "heatmap",
      source: "air-aia",
      paint: {
        "heatmap-weight": 1,
        "heatmap-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          6,
          18,
          10,
          32,
          14,
          46,
        ],
        "heatmap-opacity": opacity("aia") * 0.8,
        "heatmap-color": [
          "interpolate",
          ["linear"],
          ["heatmap-density"],
          0,
          "rgba(34,95,91,0)",
          0.15,
          "#d5eee3",
          0.4,
          "#7dbab0",
          0.7,
          "#367e79",
          1,
          "#123f48",
        ],
      },
    });
    layer({
      id: "air-aia-point",
      type: "circle",
      source: "air-aia",
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 7, 4, 13, 7],
        "circle-color": ["get", "color"],
        "circle-stroke-width": 1,
        "circle-stroke-color": "#f6f8ef",
        "circle-opacity": opacity("aia"),
        "circle-stroke-opacity": opacity("aia"),
      },
    });
    map.setPaintProperty("air-aia-point", "circle-opacity", opacity("aia"));
    map.setPaintProperty(
      "air-aia-point",
      "circle-stroke-opacity",
      opacity("aia"),
    );
    map.setPaintProperty(
      "air-aia-heat",
      "heatmap-opacity",
      opacity("aia") * 0.8,
    );
    visible("air-aia-point", on("aia") && s.aiaMode !== "heatmap");
    visible("air-aia-heat", on("aia") && s.aiaMode !== "points");
    source("air-stations", {
      type: "FeatureCollection",
      features: data.stations.map((st) => {
        const value = read(st, s.measure, s.date),
          label = [
            s.measure,
            ...(["pm10", "pm25", "no2"] as const).filter(
              (k) => k !== s.measure,
            ),
          ]
            .map(
              (k) => `${MEASURE_NAMES[k]} ${fmt(read(st, k, s.date), 1)} µg/m³`,
            )
            .join("\n");
        return {
          type: "Feature",
          id: st.id,
          geometry: { type: "Point", coordinates: st.coordinates },
          properties: {
            id: st.id,
            __featureId: st.id,
            airKind: "observations",
            name: st.name,
            label: `${st.name}\n${label}\n${s.date}`,
            __displayValue: label,
            value,
            color: stationTone(value, stationDomain(data, s.measure)),
            readingDetail: `ARPA / Open Data FVG · ${s.date} · PM: medie giornaliere, NO₂: massimo orario`,
          },
        };
      }),
    });
    const row = data.sme.find((r) => r.date === s.stackDate),
      stackLabel = `Fanna · ${s.stackDate}\nNOx ${fmt(row?.NOx, 1)} · polveri ${fmt(row?.dust, 1)} · SO₂ ${fmt(row?.SO2, 1)} mg/Nm³`;
    source("air-stack", {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          id: "fanna",
          geometry: { type: "Point", coordinates: stackSite(data) },
          properties: {
            id: "fanna",
            airKind: "stack",
            __featureId: "fanna",
            name: "Camino di Fanna",
            label: stackLabel,
            color: "#c88151",
            readingDetail:
              "SME · coordinate amministrative AIA, non posizione esatta del camino",
          },
        },
      ],
    });
    for (const k of ["observations", "stack"] as const) {
      const prefix = k === "observations" ? "station" : "stack",
        src = k === "observations" ? "air-stations" : "air-stack";
      layer({
        id: `air-${prefix}-point`,
        type: "circle",
        source: src,
        paint: {
          "circle-radius": k === "stack" ? 8 : 6,
          "circle-color": ["get", "color"],
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#f6f8ef",
          "circle-opacity": opacity(k),
          "circle-stroke-opacity": opacity(k),
        },
      });
      layer({
        id: `air-${prefix}-label`,
        type: "symbol",
        source: src,
        layout: {
          "text-field": ["get", "label"],
          "text-font": ["Open Sans Semibold"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 7, 10, 12, 12],
          "text-anchor": "left",
          "text-offset": [1.1, 0],
          "text-max-width": 15,
          "text-allow-overlap": false,
        },
        paint: {
          "text-color": "#20382b",
          "text-halo-color": "#f6f8ef",
          "text-halo-width": 2,
          "text-opacity": opacity(k),
        },
      });
      for (const id of [`air-${prefix}-point`, `air-${prefix}-label`])
        visible(id, on(k));
      map.setPaintProperty(`air-${prefix}-point`, "circle-opacity", opacity(k));
      map.setPaintProperty(
        `air-${prefix}-point`,
        "circle-stroke-opacity",
        opacity(k),
      );
      map.setPaintProperty(`air-${prefix}-label`, "text-opacity", opacity(k));
    }
    // A reconstructed style can add the raster last; preserve the approved overlay order.
    for (const id of ["air-world-raster", "air-corine-raster"])
      if (map.getLayer(id)) map.moveLayer(id, "air-inventory-fill");
  }
  const features = (e: MapMouseEvent, ids: string[]) =>
    map.queryRenderedFeatures(e.point, {
      layers: ids.filter(
        (id) =>
          map.getLayer(id) &&
          map.getLayoutProperty(id, "visibility") !== "none",
      ),
    });
  function click(e: MapMouseEvent) {
    if (
      disposed ||
      !ready ||
      useExperienceStore.getState().activeId !== "air" ||
      useAppStore.getState().drawingMode ||
      isPointReadingClick(e)
    )
      return;
    const s = useAirStore.getState();
    const hits: MapGeoJSONFeature[] = [];
    if (s.layers.observations && s.opacity.observations > 0)
      hits.push(...features(e, ["air-station-point", "air-station-label"]));
    if (s.layers.stack && s.opacity.stack > 0)
      hits.push(...features(e, ["air-stack-point", "air-stack-label"]));
    if (s.layers.aia && s.opacity.aia > 0)
      hits.push(...features(e, ["air-aia-point"]));
    const f = hits[0];
    if (f) {
      generation++;
      const kind = String(f.properties.airKind);
      selectAir(
        kind === "stack" ? "stack" : kind === "aia" ? "aia" : "observations",
        kind === "aia"
          ? { aiaId: String(f.properties.id) }
          : kind === "observations"
            ? { stationId: String(f.properties.id) }
            : {},
      );
      return;
    }
    for (const k of ["industrial", "commercial"] as const) {
      if (!s.layers[k] || s.opacity[k] <= 0) continue;
      const zone = features(e, [`air-${k}-fill`])[0];
      if (zone) {
        const original = (
          k === "industrial"
            ? s.context?.industrialZones
            : s.context?.commercialZones
        )?.features.find(
          (v) => String(v.properties.id) === String(zone.properties.id),
        );
        if (original) {
          generation++;
          selectAir("landcover", { zone: original, soil: null }, k);
        }
        return;
      }
    }
    if (
      (s.controls?.question === "landcover" ||
        s.controls?.key === "world" ||
        s.inspector?.view === "landcover") &&
      s.layers.world &&
      s.opacity.world > 0 &&
      s.world
    ) {
      const world = s.world,
        at: [number, number] = [e.lngLat.lng, e.lngLat.lat],
        serial = ++generation;
      selectAir("landcover", {
        soil: { point: at, status: "loading" },
        zone: null,
      });
      void sampleSoil(at, world).then((soil) => {
        if (
          !disposed &&
          ready &&
          serial === generation &&
          useExperienceStore.getState().activeId === "air" &&
          (useAirStore.getState().controls?.question === "landcover" ||
            useAirStore.getState().controls?.key === "world" ||
            useAirStore.getState().inspector?.view === "landcover") &&
          useAirStore.getState().world === world &&
          useAirStore.getState().layers.world
        )
          useAirStore.setState({ soil });
      });
      return;
    }
    if (s.layers.inventory && s.opacity.inventory > 0) {
      const m = features(e, ["air-inventory-fill", "air-inventory-3d"])[0];
      if (m) {
        generation++;
        selectAir("inventory", { municipalityId: String(m.properties.istat) });
      }
    }
  }
  function move(e: MapMouseEvent) {
    if (
      !ready ||
      useExperienceStore.getState().activeId !== "air" ||
      useAppStore.getState().drawingMode ||
      hasPointReadings(map)
    ) {
      clearHover();
      return;
    }
    const s = useAirStore.getState(),
      ids = [
        ...(s.layers.observations && s.opacity.observations > 0
          ? ["air-station-point"]
          : []),
        ...(s.layers.stack && s.opacity.stack > 0 ? ["air-stack-point"] : []),
        ...(s.layers.aia && s.opacity.aia > 0 ? ["air-aia-point"] : []),
      ],
      f = features(e, ids)[0];
    clearHover();
    if (f && f.geometry.type === "Point")
      popup = new Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 12,
        maxWidth: "300px",
      })
        .setLngLat(f.geometry.coordinates as [number, number])
        .setDOMContent(
          createHoverCard(
            String(f.properties.name),
            String(f.properties.label ?? f.properties.activity ?? ""),
            String(f.properties.color),
          ),
        )
        .addTo(map);
  }
  const loading = () => {
    ready = false;
    generation++;
    clearHover();
    cache.clear();
  };
  const loaded = () => {
    ready = true;
    if (useAirStore.getState().worldTileError)
      useAirStore.setState({ worldTileError: null });
    sync();
  };
  const tileError = (event: { sourceId?: string }) => {
    if (
      event.sourceId === "air-world" &&
      useExperienceStore.getState().activeId === "air" &&
      !useAirStore.getState().worldTileError
    )
      useAirStore.setState({
        worldTileError:
          "Una tessera WorldCover non è stata caricata. La copertura può essere incompleta; riprova cambiando lo sfondo mappa.",
      });
  };
  map.on("error", tileError);
  map.on("style.load", loaded);
  map.on("styledataloading", loading);
  map.on("click", click);
  map.on("mousemove", move);
  map.on("mouseout", clearHover);
  const unsub = useAirStore.subscribe(sync),
    unsubSpace = useExperienceStore.subscribe(sync),
    unsubApp = useAppStore.subscribe((s, p) => {
      if (s.view3D !== p.view3D || s.drawingMode !== p.drawingMode) sync();
    });
  sync();
  return () => {
    disposed = true;
    unsub();
    unsubSpace();
    unsubApp();
    map.off("error", tileError);
    map.off("style.load", loaded);
    map.off("styledataloading", loading);
    map.off("click", click);
    map.off("mousemove", move);
    map.off("mouseout", clearHover);
    remove();
  };
}
