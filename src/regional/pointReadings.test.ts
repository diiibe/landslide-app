import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Map as MLMap, MapGeoJSONFeature, MapMouseEvent } from "maplibre-gl";
import {useExperienceStore} from "@/spaces/store";
import { useAppStore } from "@/app/store";
import { useRegionalStore } from "./store";
import { useTwinStore } from "@/digital-twin/store";
import { readingText, selectPointReading, hasPointReadings, isPointReadingClick, mountPointReadings } from "./pointReadings";
import type { LayerDefinition } from "./types";
const nodes = vi.hoisted(() => [] as HTMLElement[]);
vi.mock("maplibre-gl", () => ({ Popup: class {
  setLngLat() { return this; }
  setDOMContent(node: HTMLElement) { nodes.push(node); return this; }
  addTo() { return this; }
  remove() { return this; }
} }));
const layer: LayerDefinition = { id:"salinity", title:"Salinità", kind:"geojson", folder:"mare", status:"ready", description:"", note:"", provider:"OGS", sourceId:"MAMBO3", sourceUrl:"https://example.com", license:"CC BY4", licenseUrl:"https://example.com", cadence:"", color:"#678456" };
function feature(id: string, depth: number, value: string) {
  return { type:"Feature", id, source:"regional-salinity", layer:{id:"regional-salinity-point"}, geometry:{type:"Point",coordinates:[13,46]}, properties:{__featureId:id,__name:"MAMBO3",__depth:depth,__displayValue:value,__unit:"PSU"} } as unknown as MapGeoJSONFeature;
}
let teardown: (() => void) | undefined;
beforeEach(() => {
  nodes.length = 0;
  useExperienceStore.setState({activeId:null});
  vi.stubGlobal("matchMedia", () => ({matches:false}));
  useAppStore.setState({drawingMode:false,drawerOpen:false});
  useRegionalStore.setState({catalog:{generatedAt:"2026-01-01",layers:[layer]},selection:null,enabled:{salinity:true},entries:{}});
});
afterEach(() => { teardown?.(); vi.unstubAllGlobals(); });
function harness(features: MapGeoJSONFeature[]) {
  const handlers = new Map<string, (event: MapMouseEvent) => void>(), canvas = document.createElement("canvas");
  let frame: FrameRequestCallback | null = null;
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => {frame=fn;return 1;});
  vi.stubGlobal("cancelAnimationFrame", () => {frame=null;});
  const map = {getStyle:()=>({layers:[{id:"regional-salinity-point",type:"circle"}]}), queryRenderedFeatures:vi.fn(()=>features),project:()=>({x:10,y:10}),getCanvas:()=>canvas,getContainer:()=>({clientHeight:700}),getSource:vi.fn(),easeTo:vi.fn(),
    on:(key:string, fn:(event:MapMouseEvent)=>void)=>handlers.set(key,fn), off:vi.fn(),
  } as unknown as MLMap;
  teardown=mountPointReadings(map);
  const event={point:{x:10,y:10},originalEvent:new MouseEvent("click")} as MapMouseEvent;
  return {map,handlers,event,flush:()=>{const fn=frame;frame=null;fn?.(1);}};
}
it("lists every reading with value, unit and zero depth, and opens the exact chosen record", () => {
  const h=harness([feature("surface",0,"37.2"), feature("deep",10,"<0.01")]);
  h.handlers.get("click")!(h.event);
  expect(isPointReadingClick({...h.event} as MapMouseEvent)).toBe(true);
  expect(hasPointReadings(h.map)).toBe(true);
  const node=nodes.at(-1)!;
  expect(node.textContent).toContain("2 dati in questo punto");
  expect(node.textContent).toContain("Profondità 0 m");
  expect(node.textContent).toContain("37.2 PSU");
  expect(node.textContent).toContain("<0.01 PSU");
  node.querySelectorAll("ol button")[1]!.dispatchEvent(new MouseEvent("click"));
  expect(useRegionalStore.getState().selection?.feature.properties?.__featureId).toBe("deep");
  expect(useAppStore.getState().drawerOpen).toBe(true);
  expect(hasPointReadings(h.map)).toBe(false);
});
it("refreshes open readings after source updates and removes them when the source is hidden", () => {
  const features=[feature("surface",0,"37.2"),feature("deep",10,"37.1")], h=harness(features);
  h.handlers.get("click")!(h.event);
  features[0]!.properties!.__displayValue="38.0";
  h.handlers.get("sourcedata")!(h.event); h.flush();
  expect(nodes.at(-1)!.textContent).toContain("38.0 PSU");
  vi.mocked(h.map.queryRenderedFeatures).mockReturnValue([]);
  useRegionalStore.setState({enabled:{salinity:false}}); h.flush();
  expect(hasPointReadings(h.map)).toBe(false);
});
it("leaves a single reading, clusters and drawing gestures to their existing tools", () => {
  const h=harness([feature("single",0,"37")]);
  h.handlers.get("click")!(h.event);
  expect(nodes).toHaveLength(0);
  vi.mocked(h.map.queryRenderedFeatures).mockReturnValue([feature("a",0,"1"),feature("b",10,"2")]);
  useAppStore.setState({drawingMode:true});
  h.handlers.get("click")!(h.event);
  expect(nodes).toHaveLength(0);
  expect(isPointReadingClick(h.event)).toBe(false);
});
it("preserves the variable of a selected PCR reading sharing another variable's coordinates", () => {
  const pcr=(variable:string)=>({type:"Feature",source:"twin-sensors-"+variable,layer:{id:"twin-sensors-"+variable},geometry:{type:"Point",coordinates:[13,46]},properties:{stationId:12,variable,label:variable==="wind"?"3 m/s":"15 °C",name:"Stazione"}}) as unknown as MapGeoJSONFeature;
  const h=harness([pcr("wind"),pcr("temperature")]);
  h.handlers.get("click")!(h.event);
  const rows=nodes.at(-1)!.querySelectorAll("ol button");
  expect(rows).toHaveLength(2);
  rows[1]!.dispatchEvent(new MouseEvent("click"));
  expect(useTwinStore.getState().variable).toBe("temperature");
  expect(useTwinStore.getState().selection).toEqual({kind:"sensor",stationId:12});
});

it("opens all records in a cluster at identical coordinates without repeated zooming", async () => {
  const cluster={...feature("group",0,""), properties:{cluster:true,cluster_id:7,point_count:2}} as unknown as MapGeoJSONFeature;
  const h=harness([cluster]);
  const source={getClusterLeaves:vi.fn(async()=>[feature("surface",0,"37.2"),feature("deep",10,"37.1")]),getClusterExpansionZoom:vi.fn(async()=>14)};
  vi.mocked(h.map.getSource).mockReturnValue(source as never);
  h.handlers.get("click")!(h.event);
  await vi.waitFor(()=>expect(nodes.at(-1)?.textContent).toContain("2 dati in questo punto"));
  expect(source.getClusterLeaves).toHaveBeenCalledWith(7,2,0);
  expect(h.map.easeTo).not.toHaveBeenCalled();
});
it("continues normal geographic cluster expansion when leaves are at different positions", async () => {
  const cluster={...feature("group",0,""), properties:{cluster:true,cluster_id:7,point_count:2}} as unknown as MapGeoJSONFeature;
  const h=harness([cluster]), first=feature("first",0,"1"),second=feature("second",0,"2");
  second.geometry={type:"Point",coordinates:[13.01,46]};
  const source={getClusterLeaves:vi.fn(async()=>[first,second]),getClusterExpansionZoom:vi.fn(async()=>12)};
  vi.mocked(h.map.getSource).mockReturnValue(source as never);
  h.handlers.get("click")!(h.event);
  await vi.waitFor(()=>expect(h.map.easeTo).toHaveBeenCalled());
  expect(nodes).toHaveLength(0);
});

it("opens the Space layers tab for an additional real source, and the own inspector for a Nature record",()=>{
 useExperienceStore.setState({activeId:"park",tab:"tools"});
 const tree={...feature("tree-a",0,""),source:"nature-nodes",layer:{id:"nature-node"},properties:{id:"tree-a",__featureId:"tree-a",natureSpace:"park",name:"Larix decidua",readingDetail:"ERPAC · rilievo storico"}} as unknown as MapGeoJSONFeature;
 const h=harness([tree,feature("other",0,"37")]);h.handlers.get("click")!(h.event);nodes.at(-1)!.querySelectorAll("ol button")[0]!.dispatchEvent(new MouseEvent("click"));
 expect(useExperienceStore.getState().selectedId).toBe("tree-a");expect(useExperienceStore.getState().tab).toBe("overview");
 h.handlers.get("click")!(h.event);nodes.at(-1)!.querySelectorAll("ol button")[1]!.dispatchEvent(new MouseEvent("click"));expect(useExperienceStore.getState().tab).toBe("layers");expect(useRegionalStore.getState().selection?.layerId).toBe("salinity");useExperienceStore.setState({activeId:null});
});

it("keeps SmartTrek provenance and opens its own inspector from coincident readings",()=>{
 useExperienceStore.setState({activeId:"trek",tab:"layers"});
 const node={...feature("st-106",0,""),source:"trek-nodes",layer:{id:"trek-node"},properties:{id:"st-106",__featureId:"st-106",name:"Segnavia 106",readingValue:"4 BLE · 110 mW",readingDetail:"Demo · campione sintetico",color:"#86b79b"}} as unknown as MapGeoJSONFeature;
 expect(readingText(node)).toEqual({title:"Segnavia 106",value:"4 BLE · 110 mW",detail:"Demo · campione sintetico",color:"#86b79b"});
 selectPointReading(node);expect(useExperienceStore.getState()).toMatchObject({tab:"overview",selectedId:"st-106"});
});

it("does not open a multiple-readings panel for observations shown by native map labels", () => {
  const h = harness([feature("surface", 0, "37.2"), feature("deep", 10, "37.1")]);
  vi.spyOn(h.map, "getStyle").mockReturnValue({ version: 8, sources: {}, layers: [
    { id: "regional-salinity-point", type: "circle", source: "regional-salinity" },
    { id: "regional-salinity-labels", type: "symbol", source: "regional-salinity", layout: { "text-field": ["get", "__mapLabel"] } },
  ] });
  h.handlers.get("click")!(h.event);
  expect(nodes).toHaveLength(0);
  expect(hasPointReadings(h.map)).toBe(false);
  expect(isPointReadingClick(h.event)).toBe(false);
});
