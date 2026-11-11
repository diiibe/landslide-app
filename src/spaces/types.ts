import type { IconName } from "@/ui/Icon";
export type SpaceId =
  | "landslides"
  | "industry"
  | "vineyard"
  | "retail"
  | "traffic"
  | "mountain"
  | "fire"
  | "wildlife"
  | "park"
  | "trek";
export type NatureId = "fire" | "wildlife" | "park" | "trek";
export const isNatureSpace = (id: string | null): id is NatureId => id === "fire" || id === "wildlife" || id === "park" || id === "trek";
export type DemoId = Exclude<SpaceId, "landslides" | NatureId>;
export type Scenario = "normal" | "peak" | "rain" | "efficient";
export type Metric =
  | "power"
  | "solar"
  | "temperature"
  | "vibration"
  | "pressure"
  | "water"
  | "moisture"
  | "humidity"
  | "tank"
  | "entries"
  | "people"
  | "parking"
  | "co2"
  | "flow"
  | "speed"
  | "queue"
  | "wind"
  | "lift";
export interface DemoSensor {
  id: string;
  name: string;
  zone: string;
  metric: Metric;
  coordinates: [number, number];
  unit: string;
  base: number;
  amplitude: number;
  low?: number;
  high?: number;
  capacity?: number;
  note: string;
}
export interface DemoZone {
  id: string;
  name: string;
  kind: string;
  color: string;
  geometry: GeoJSON.Polygon;
  capacity?: number;
  share?: number;
}
export interface DemoRoute {
  id: string;
  name: string;
  coordinates: [number, number][];
  kind: "logistics" | "visitors" | "traffic" | "lift";
  capacity: number;
}
export interface Experience {
  id: SpaceId;
  title: string;
  subtitle: string;
  description: string;
  icon: IconName;
  tone: string;
  center: [number, number];
  zoom: number;
  reference: { name: string; url: string; note: string };
  perimeter?: GeoJSON.Polygon;
  zones: DemoZone[];
  sensors: DemoSensor[];
  routes: DemoRoute[];
  scenarios: { id: Scenario; title: string; detail: string }[];
  questions: string[];
}
export interface Sample {
  value: number;
  status: "normal" | "watch" | "alert";
  label: string;
}
export interface ScenarioState {
  id: Scenario;
  since: number;
}
