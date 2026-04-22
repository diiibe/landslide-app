export type ModelId = "j2" | "j3";
export type Basemap = "outdoors" | "light" | "satellite";

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
