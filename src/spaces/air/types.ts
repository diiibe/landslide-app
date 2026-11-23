export type AirLayer =
  | "inventory"
  | "observations"
  | "stack"
  | "aia"
  | "world"
  | "industrial"
  | "commercial"
  | "corine";
export type AirQuestion = "inventory" | "observations" | "landcover";
export type AirView = AirQuestion | "stack" | "aia";
export type Pollutant = "NOx" | "PM10" | "PM2_5";
export type Measure = "pm10" | "pm25" | "no2";
export type Sector = "industry" | "nonindustrial" | "road" | "all";
export type AiaCategory = "all" | "industry" | "farm" | "waste" | "other";
export interface AirSource {
  id?: string;
  title: string;
  url: string;
  dataUrl?: string;
  kind: string;
  period: string;
  license: string;
  note: string;
  sha256?: string;
}
export interface SourceStatus {
  checkedAt: string;
  retrievedAt: string | null;
  latestMeasurement?: string | null;
  error: string | null;
  cadence: string;
  validation?: string;
}
export interface Observation {
  date: string;
  value: number | null;
  raw: string | null;
  valid: boolean;
  insufficient?: boolean;
  maxHour?: string | null;
  validation?: string;
}
export interface Station {
  id: string;
  name: string;
  coordinates: [number, number];
  series: Partial<Record<Measure, Observation[]>>;
}
export type Municipality = GeoJSON.Feature<
  GeoJSON.Polygon | GeoJSON.MultiPolygon,
  {
    istat: string | number;
    name: string;
    center: [number, number];
    sectors: {
      code: number;
      name: string;
      values: Record<Pollutant, number | null>;
    }[];
  }
>;
export type AiaFeature = GeoJSON.Feature<
  GeoJSON.Point,
  {
    id: string;
    name: string;
    municipality: string;
    activity: string;
    state: string;
    code: string;
    sourceUrl: string;
  }
>;
export type ZoneFeature = GeoJSON.Feature<
  GeoJSON.Polygon | GeoJSON.MultiPolygon,
  {
    id: string;
    name: string;
    municipality: string;
    zone: string;
    subzone: string;
    validDate: string | null;
    variant: string | null;
    norm: string | null;
  }
>;
export interface StackRow {
  date: string;
  NOx: number | null;
  dust: number | null;
  SO2: number | null;
  rawNOx?: string;
  rawDust?: string;
  rawSO2?: string;
  status?: string;
  flow?: number | null;
  unit: string;
  source: string;
}
export interface AirData {
  snapshot: string;
  retrievedAt: string;
  municipalities: GeoJSON.FeatureCollection<
    Municipality["geometry"],
    Municipality["properties"]
  >;
  stations: Station[];
  aia: GeoJSON.FeatureCollection<GeoJSON.Point, AiaFeature["properties"]>;
  sme: StackRow[];
  sources: AirSource[];
  sourceStatus: Record<string, SourceStatus>;
}
export interface AirContext {
  snapshot: string;
  retrievedAt?: string;
  industrialZones: GeoJSON.FeatureCollection<
    ZoneFeature["geometry"],
    ZoneFeature["properties"]
  >;
  commercialZones: GeoJSON.FeatureCollection<
    ZoneFeature["geometry"],
    ZoneFeature["properties"]
  >;
  sources: AirSource[];
  sourceStatus?: Record<string, SourceStatus>;
}
export interface WorldCover {
  title: string;
  referenceYear: number;
  tileSize: number;
  minzoom: number;
  maxzoom: number;
  bounds: [number, number, number, number];
  classes: { code: number; name: string; color: string }[];
  presentClasses?: number[];
  credit: string;
  url: string;
  license: string;
  sourceSha256: string;
}
export interface SoilReading {
  point: [number, number];
  status: "loading" | "ready" | "missing" | "outside" | "error";
  code?: number;
  name?: string;
}
