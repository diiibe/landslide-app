import type { Variable } from "@/digital-twin/data";
export type FolderId =
  | "meteo"
  | "mare"
  | "aria"
  | "energia"
  | "trasformazioni"
  | "attivita"
  | "ambiente"
  | "acqua"
  | "verde"
  | "servizi"
  | "mobilita"
  | "infrastrutture"
  | "contesto";
export const FOLDERS: Record<FolderId, string> = {
  meteo: "Meteo e precipitazioni",
  mare: "Mare e costa",
  aria: "Qualità dell’aria e pollini",
  energia: "Energia",
  trasformazioni: "Territorio e trasformazioni",
  attivita: "Attività produttive e porto",
  ambiente: "Ambiente e rifiuti",
  acqua: "Acque e risorsa idrica",
  verde: "Verde e biodiversità",
  servizi: "Città e servizi",
  mobilita: "Mobilità",
  infrastrutture: "Infrastrutture e telecomunicazioni",
  contesto: "Cartografie e rilievi",
};
export interface LiveSource {
  url: string;
  parameter: string;
  sensorId?: string;
  depth?: number;
  name?: string;
  profile?: boolean;
}
export interface LayerDefinition {
  id: string;
  title: string;
  folder: FolderId;
  subfolder?: string;
  description: string;
  note: string;
  status: "ready" | "blocked";
  kind?:
    | "geojson"
    | "vector"
    | "raster"
    | "pcr"
    | "radar"
    | "buildings"
    | "aia";
  file?: string;
  sourceLayer?: string;
  tiles?: string[];
  minzoom?: number;
  maxzoom?: number;
  sourceId: string;
  sourceUrl: string;
  provider: string;
  license: string;
  licenseUrl: string;
  cadence: string;
  color: string;
  count?: number;
  sourceCount?: number;
  inputRows?: number;
  retrievedAt?: string;
  generatedAt?: string;
  dataDate?: string;
  lastCheckedAt?: string;
  problem?: string;
  refreshError?: string;
  warnings?: string[];
  bounds?: [[number, number], [number, number]];
  geometryTypes?: string[];
  fields?: string[];
  pcrVariable?: Variable;
  metric?: { field: string; unit: string; min?: number; max?: number };
  pollUrl?: string;
  live?: LiveSource[];
  liveKind?: "erddap" | "earthquakes" | "webcams" | "pcr";
  pcrSensorId?: number;
  history?: {
    kind: "socrata";
    sourceId: string;
    dateField: string;
    valueField: string;
    parameterField: string | null;
    parameter: string | null;
  };
}
export interface RegionalCatalog {
  generatedAt: string;
  layers: LayerDefinition[];
  families?: { title: string; layerIds: string[]; problem?: string }[];
  refreshHours?: number;
}
export type MapData = GeoJSON.FeatureCollection;
export interface LayerEntry {
  data?: MapData;
  loading: boolean;
  error: string | null;
  receivedAt?: number;
  snapshot: boolean;
  sourceVersion?: string;
  refreshKey?: number;
}
export interface MapSelection {
  layerId: string;
  feature: GeoJSON.Feature;
}
