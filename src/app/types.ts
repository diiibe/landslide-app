export type ModelId = "j2" | "j3";

/** Critical-structure and hut categories carried by features in
 *  `poi_fvg.geojson`. Stable strings — used as MapLibre filter values
 *  and as keys for the user-customisable colour map. */
export type PoiCategory =
  | "hospital"
  | "fire_station"
  | "police"
  | "school"
  | "alpine_hut"
  | "wilderness_hut";

export const POI_CATEGORIES: PoiCategory[] = [
  "hospital",
  "fire_station",
  "police",
  "school",
  "alpine_hut",
  "wilderness_hut",
];

export const POI_DEFAULT_COLORS: Record<PoiCategory, string> = {
  hospital: "#FF3D5A",
  fire_station: "#FF7A1F",
  police: "#3F8CFF",
  school: "#FFD400",
  alpine_hut: "#2FCB6E",
  wilderness_hut: "#00E0D6",
};

export const POI_CATEGORY_LABELS: Record<PoiCategory, string> = {
  hospital: "Hospital",
  fire_station: "Fire station",
  police: "Police",
  school: "School",
  alpine_hut: "Alpine hut",
  wilderness_hut: "Wilderness hut",
};

/* ───── User-uploaded layers & drawn areas ───── */

export type UserLayerKind = "gpx" | "geojson";

/** Colour mode for a user-uploaded line layer.
 *  - `solid`: the user-picked `color` paints the whole line.
 *  - `riskHeatmap`: each segment is baked against the active model's
 *    cell grid and tinted with the trails risk ramp, so the line
 *    reads as a heatmap of slide susceptibility along its path. */
export type UserLayerColorMode = "solid" | "riskHeatmap";

export interface UserLayer {
  /** Stable id used in MapLibre source/layer ids and the store array key.
   *  Generated at upload time (timestamp + random suffix). */
  id: string;
  /** Display name, defaulted to the original filename without extension. */
  name: string;
  kind: UserLayerKind;
  /** Hex colour driving the line/glow stack. User-editable via swatch. */
  color: string;
  /** 0..1 multiplier on every layer's paint opacity. */
  opacity: number;
  visible: boolean;
  /** Parsed FeatureCollection ready to feed a `geojson` source. */
  data: GeoJSON.FeatureCollection;
  /** Track bounds for the optional fitBounds-on-load nicety. */
  bounds: [[number, number], [number, number]] | null;
  /** Unix ms — used for sort + localStorage round-trip. */
  createdAt: number;
  /** Default solid colouring. `riskHeatmap` re-paints the line with the
   *  trails risk ramp, baked against the active model's cell grid. */
  colorMode?: UserLayerColorMode;
}

export interface UserPolygonStats {
  /** km² of the polygon itself. */
  areaKm2: number;
  /** Susceptibility cells visible *inside* the polygon at save time. */
  cellsVisible: number;
  cellsAboveThreshold: number;
  meanP: number;
  medianP: number;
  /** IFFI feature count whose centroid falls inside the polygon. */
  iffiCount: number;
  /** Threshold + model in force when the stats were computed — without
   *  this the numbers above are meaningless out of context. */
  threshold: number;
  model: ModelId;
}

export interface UserPolygon {
  id: string;
  name: string;
  color: string;
  /** Single-Polygon geometry (4326). MultiPolygon support deferred. */
  geometry: GeoJSON.Polygon;
  bounds: [[number, number], [number, number]];
  stats: UserPolygonStats;
  createdAt: number;
}

/**
 * Zone count per model. Used by `useMapStats` to render `zones_active /
 * zones_total` without hardcoding 5 at the call site (P3 nit). Both J.2
 * and J.3 currently have 5 zones — when a J.4 with a different cardinality
 * lands, only this constant changes.
 */
export const MODEL_ZONE_COUNT: Record<ModelId, number> = {
  j2: 5,
  j3: 5,
};
export type Basemap = "outdoors" | "light" | "satellite" | "dark";
export type Theme = "light" | "dark";

export type Threshold = 0.3 | 0.5 | 0.7 | 0.85;

export type J2Zone = "Alpine" | "Carso" | "Hills" | "Plain" | "Prealpine";
export type J3Zone =
  | "Alpine_Snow"
  | "Forested_Hills"
  | "Rocky_Bare"
  | "Steep_Mountain"
  | "Transitional_Dry";
export type Zone = J2Zone | J3Zone;

export interface ZoneStat {
  zone: Zone;
  n: number;
  n_pos: number;
  prevalence: number;
  auc: number;
  ece: number;
  mean_p: number;
}

export interface ModelStats {
  model: ModelId;
  auc_pooled: number;
  pr_auc: number;
  ece: number;
  brier: number;
  cells_trained: number;
  cv_folds: number;
  zones: ZoneStat[];
  /** 9 reliability bins for the calibration plot. */
  calibration: { p_pred: number; observed: number }[];
}

export interface IffiFeatureProps {
  id_frana: string;
  tipo_movimento: string;
  nome_tipo: string;
  comune: string;
  provincia: string;
}

export interface CellProps {
  cell_id: number;
  p: number;
  zone: Zone;
  sub_zone: string;
  iffi_hit: boolean;
}

export interface ViewStats {
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
  /** 10 bins, each is the share of visible cells in that p-range. */
  histogram: number[];
  /** Per-zone mean probability, scaled 0..1, in the order returned by ModelStats.zones. */
  mean_by_zone: { zone: Zone; mean_p: number }[];
  iffi_by_type: { tipo: string; count: number }[];
}
