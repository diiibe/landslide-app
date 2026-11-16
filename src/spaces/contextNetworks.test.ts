import { afterEach, expect, it, vi } from "vitest";
import { createExpression } from "@maplibre/maplibre-gl-style-spec";
import { useAppStore } from "@/app/store";
import { useExperienceStore } from "./store";
import { mountContextNetworks, networkColor, networkMapping } from "./contextNetworks";
import { v2ClassColor } from "@/map/layers/modelV2";
afterEach(()=>{vi.unstubAllGlobals();useAppStore.getState().reset();useExperienceStore.setState({activeId:null,contextError:null,contextReady:false,analysisLayer:"bodies"});});
it("uses exact heatmap grade colours, the active map and only the selected grades",()=>{
 const a=useAppStore.getState();
 expect(networkMapping({...a,layers:{...a.layers,v2Bodies:false,v2Diffuse:false}},"bodies")).toBeNull();
 expect(networkMapping({...a,layers:{...a.layers,v2Bodies:true,v2Diffuse:false}},"diffuse")).toBe("bodies");
 expect(networkMapping({...a,layers:{...a.layers,v2Bodies:true,v2Diffuse:true}},"diffuse")).toBe("diffuse");
 for(const which of ["bodies","diffuse"] as const){
  const expression=createExpression(networkColor(which,[1,3,5],false));expect(expression.result).toBe("success");
  if(expression.result!=="success")return;
  for(let c=0;c<=5;c++)expect(expression.value.evaluate({zoom:12},{type:2,properties:{b:c,d:c}})).toBe([1,3,5].includes(c)?v2ClassColor(c,5):"#62716c");
 }
});
it("keeps one network renderer across territory/Space transitions, restores after style reload and hides disabled networks",async()=>{
 const sources=new Map(),layers=new Map(),handlers=new Map<string,()=>void>(),paints=new Map(),visibility=new Map();
 const m={isStyleLoaded:()=>true,on:(n:string,f:()=>void)=>handlers.set(n,f),off:vi.fn(),getSource:(n:string)=>sources.get(n),getLayer:(n:string)=>layers.get(n),addSource:(n:string,s:unknown)=>sources.set(n,s),addLayer:(s:{id:string})=>layers.set(s.id,s),setPaintProperty:(n:string,_:string,v:unknown)=>paints.set(n,v),setLayoutProperty:(n:string,_:string,v:unknown)=>visibility.set(n,v),removeLayer:(n:string)=>layers.delete(n),removeSource:(n:string)=>sources.delete(n)};
 vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:true,json:async()=>({networks:{roads:{tiles:"r.pmtiles",tileSha:"r"},trails:{tiles:"t.pmtiles",tileSha:"t"}}})}));
 useAppStore.setState(s=>({layers:{...s.layers,roads:true,trails:true,v2Bodies:true,v2Diffuse:false}}));
 const dispose=mountContextNetworks(m as never);await vi.waitFor(()=>expect(layers.size).toBe(2));
 const initial=paints.get("space-context-roads-line");
 useExperienceStore.setState({activeId:"landslides"});expect(paints.get("space-context-roads-line")).toEqual(initial);
 useAppStore.setState(s=>({susceptibilityStyle:{...s.susceptibilityStyle,bodies:{...s.susceptibilityStyle.bodies,classes:[5]}}}));expect(paints.get("space-context-roads-line")).toEqual(networkColor("bodies",[5],useAppStore.getState().theme==="dark"));
 handlers.get("styledataloading")!();sources.clear();layers.clear();handlers.get("style.load")!();expect(layers.size).toBe(2);
 useAppStore.setState(s=>({layers:{...s.layers,roads:false}}));expect(visibility.get("space-context-roads-line")).toBe("none");
 dispose();expect(sources.size).toBe(0);expect(layers.size).toBe(0);
});
