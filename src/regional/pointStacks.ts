import { Marker, type Map as MLMap, type MapGeoJSONFeature } from "maplibre-gl";
import { useAppStore } from "@/app/store";
import { useTwinStore } from "@/digital-twin/store";
import { useExperienceStore } from "@/spaces/store";
import { useInterfaceSettings } from "@/ui/interfaceSettings";
import { useRegionalStore } from "./store";
import { dataFeatureKey, dataLayers } from "./mapPicking";
import { hasPointReadings, readingText, selectPointReading } from "./pointReadings";
import styles from "./PointStacks.module.css";
export function groupedPointReadings(features: MapGeoJSONFeature[]) {
  const groups = new Map<string, Map<string, MapGeoJSONFeature>>();
  for (const feature of features) {
    if (feature.geometry.type !== "Point" || feature.properties?.cluster || feature.properties?.__overview) continue;
    const [x,y] = feature.geometry.coordinates;
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const position = `${x!.toFixed(7)},${y!.toFixed(7)}`;
    let group = groups.get(position); if (!group) groups.set(position,group=new Map());
    group.set(dataFeatureKey(feature), feature);
  }
  return new Map([...groups].filter(([,records])=>records.size>1).map(([key,records])=>[key,[...records.values()].sort((a,b)=>readingText(a).title.localeCompare(readingText(b).title,"it")||dataFeatureKey(a).localeCompare(dataFeatureKey(b)))]));
}
/** Display every enabled reading at shared coordinates. At regional zoom a
 * count expands in place; at local zoom the entire list opens automatically. */
export function mountPointStacks(map:MLMap) {
  const markers = new Map<string,{marker:Marker;element:HTMLElement;signature:string;placement:string}>();
  const expanded = new Map<string,boolean>();
  const controlSelector='[data-map-3d],[aria-label="Comandi mappa"],.maplibregl-ctrl-group,.maplibregl-ctrl-attrib,[data-map-space-bar]';
  const observed=new Set<Element>();
  const resize=typeof ResizeObserver==="undefined"?null:new ResizeObserver(()=>schedule());
  function controlRects() {
    const controls=Array.from(document.querySelectorAll<HTMLElement>(controlSelector));
    for(const old of observed)if(!controls.includes(old as HTMLElement)){resize?.unobserve(old);observed.delete(old);}
    for(const control of controls)if(!observed.has(control)){observed.add(control);resize?.observe(control);}
    return controls.map(el=>el.getBoundingClientRect()).filter(r=>r.width>0&&r.height>0);
  }
  let timer:ReturnType<typeof setTimeout>|undefined,ready=false,disposed=false;
  const clear=()=>{for(const record of markers.values())record.marker.remove();markers.clear();};
  function sync() {
    timer=undefined;
    if(disposed||!ready||document.hidden||useAppStore.getState().drawingMode||hasPointReadings(map)){clear();return;}
    const layers=dataLayers(map);if(!layers.length){clear();return;}
    const visible=map.queryRenderedFeatures({layers}).filter(f=>{
      if(f.geometry.type!=="Point")return false;
      const id=f.source.startsWith("regional-")?f.source.slice(9):f.source.startsWith("twin-sensors")?"pcr-"+String(f.properties.variable):f.source==="twin-aia"?"twin-aia":null;
      if(id&&useRegionalStore.getState().opacity[id]===0)return false;
      if(f.layer.type==="circle")return map.getPaintProperty(f.layer.id,"circle-opacity")!==0;
      if(f.layer.type==="symbol"){
        const text=map.getPaintProperty(f.layer.id,"text-opacity"),icon=map.getPaintProperty(f.layer.id,"icon-opacity");
        const layout=f.layer.layout;
        return layout?.["text-field"]||layout?.["icon-image"] ? !!(layout["text-field"]&&text!==0||layout["icon-image"]&&icon!==0) : text!==0&&icon!==0;
      }
      return false;
    });
    const groups=groupedPointReadings(visible);
    const container=map.getContainer(),box=container.getBoundingClientRect();
    let width=container.clientWidth,height=container.clientHeight;
    const drawer=document.getElementById("drawer-panel");
    if(drawer&&useAppStore.getState().drawerOpen&&getComputedStyle(drawer).position==="absolute"){
      const r=drawer.getBoundingClientRect();
      if(r.width>=width-1)height=Math.max(0,r.top-box.top);else width=Math.max(0,r.left-box.left);
    }
    const occlusions=controlRects().map(r=>({left:r.left-box.left,top:r.top-box.top,right:r.right-box.left,bottom:r.bottom-box.top}));
    const keep=new Set<string>();
    for(const [key,features] of groups){
      const first=features[0]!;if(first.geometry.type!=="Point")continue;
      const coordinates=first.geometry.coordinates.slice(0,2) as [number,number],position=map.project(coordinates);
      if(position.x<0||position.y<0||position.x>width||position.y>height)continue;
      keep.add(key);
      const open=expanded.get(key)??map.getZoom()>=10;
      const candidates=(["top-left","top-right","bottom-left","bottom-right"] as const).map(placement=>{
        const left=placement.endsWith("right"),up=placement.startsWith("bottom");
        const maxWidth=Math.max(44,Math.min(260,(left?position.x:width-position.x)-24));
        const maxHeight=Math.max(44,Math.min(340,(up?position.y:height-position.y)-24));
        const estimate=open?Math.min(maxHeight,54+features.length*70):44;
        const x=left?position.x-10-maxWidth:position.x+10,y=up?position.y-12-estimate:position.y+12;
        const collision=occlusions.reduce((sum,r)=>sum+Math.max(0,Math.min(x+maxWidth,r.right)-Math.max(x,r.left))*Math.max(0,Math.min(y+estimate,r.bottom)-Math.max(y,r.top)),0);
        return {placement,maxWidth,maxHeight,offset:[left?-10:10,up?-12:12] as [number,number],valid:x>=0&&y>=0&&x+maxWidth<=width&&y+estimate<=height,score:collision*100+(260-maxWidth)*2+Math.max(0,Math.min(340,54+features.length*70)-maxHeight)};
      }).filter(candidate=>candidate.valid).sort((a,b)=>a.score-b.score);
      const {placement,maxWidth,maxHeight,offset}=candidates[0]??{placement:"top-left" as const,maxWidth:Math.max(1,Math.min(260,width-16)),maxHeight:Math.max(1,Math.min(340,height-16)),offset:[8-position.x,8-position.y] as [number,number]};
      const texts=features.map(f=>readingText(f));
      const title=useInterfaceSettings.getState().config.texts.readings??"Letture nello stesso punto";
      const signature=JSON.stringify([features.map(dataFeatureKey),texts,open,maxHeight,maxWidth,title,width,offset]);
      let record=markers.get(key);
      if(record?.signature===signature&&record.placement===placement)continue;
      const focusKey=record?.element.contains(document.activeElement)?(document.activeElement as HTMLElement).dataset.reading:undefined;
      const scroll=record?.element.querySelector("ol")?.scrollTop??0;
      const element=document.createElement("section");element.className=styles.stack!;element.dataset.ui="sensor";element.setAttribute("aria-label",`${features.length} ${title.toLocaleLowerCase("it")}`);element.style.maxWidth=`${maxWidth}px`;element.style.maxHeight=`${maxHeight}px`;
      const toggle=document.createElement("button");toggle.type="button";toggle.dataset.reading="__toggle";toggle.className=styles.heading!;toggle.textContent=`${features.length} ${title.toLocaleLowerCase("it")}`;toggle.setAttribute("aria-expanded",String(open));toggle.title="Mostra o raccogli tutte le letture di questa posizione";
      toggle.onclick=()=>{expanded.set(key,!open);sync();};element.append(toggle);
      if(open){
        const list=document.createElement("ol");list.style.maxHeight=`${Math.max(0,maxHeight-44)}px`;list.setAttribute("aria-label","Tutti i dati del punto");
        features.forEach((feature,index)=>{
          const text=texts[index]!,item=document.createElement("li"),button=document.createElement("button"),name=document.createElement("span"),value=document.createElement("strong"),detail=document.createElement("small");
          button.type="button";button.dataset.reading=dataFeatureKey(feature);button.style.setProperty("--reading-color",text.color);
          name.textContent=text.title;value.textContent=text.value;detail.textContent=text.detail;button.title=[text.title,text.value,text.detail].filter(Boolean).join(" · ");
          button.append(name,value,detail);button.onclick=()=>selectPointReading(feature);item.append(button);list.append(item);
        });element.append(list);list.scrollTop=scroll;
      }
      // Marker DOM events must never select the feature drawn underneath.
      for(const event of ["click","dblclick","pointerdown","mousedown","touchstart","wheel"])element.addEventListener(event,e=>e.stopPropagation());
      record?.marker.remove();
      const marker=new Marker({element,anchor:placement,offset}).setLngLat(coordinates).addTo(map);
      if(element.querySelector("ol"))element.querySelector("ol")!.scrollTop=scroll;
      record={marker,element,signature,placement};markers.set(key,record);
      const restore=focusKey?Array.from(element.querySelectorAll<HTMLButtonElement>("button[data-reading]")).find(e=>e.dataset.reading===focusKey):undefined;
      restore?.focus({preventScroll:true});
    }
    for(const [key,record] of markers)if(!keep.has(key)){record.marker.remove();markers.delete(key);}
  }
  function schedule(){if(timer===undefined&&!disposed)timer=setTimeout(sync,180);}
  const loaded=()=>{ready=true;schedule();},loading=()=>{ready=false;clear();};
  const visibility=()=>{if(document.hidden)clear();else schedule();};
  map.on("style.load",loaded);map.on("styledataloading",loading);
  const sourced=(event?:{sourceId?:string})=>{if(!event?.sourceId||/^(regional-|twin-sensors|nature-nodes|trek-nodes)/.test(event.sourceId))schedule();};
  map.on("sourcedata",sourced);
  for(const event of ["moveend","resize","click"] as const)map.on(event,schedule);
  const sheetVisibility=()=>{if(hasPointReadings(map))clear();schedule();};
  containerListener(true);
  function containerListener(add:boolean){map.getContainer()[add?"addEventListener":"removeEventListener"]("fvg:readings-visibility",sheetVisibility);}
  document.addEventListener("visibilitychange",visibility);
  const stops=[
    useAppStore.subscribe((s,p)=>{if(s.drawingMode)clear();if(s.layers!==p.layers||s.drawerOpen!==p.drawerOpen||s.drawingMode!==p.drawingMode)schedule();}),
    useTwinStore.subscribe((s,p)=>{if(s.measures!==p.measures||s.active!==p.active||s.sensorsFeed!==p.sensorsFeed)schedule();}),
    useRegionalStore.subscribe((s,p)=>{if(s.enabled!==p.enabled||s.entries!==p.entries||s.filters!==p.filters||s.opacity!==p.opacity)schedule();}),
    useExperienceStore.subscribe((s,p)=>{if(s.activeId!==p.activeId){clear();schedule();}}),
    useInterfaceSettings.subscribe((s,p)=>{if(s.config.texts!==p.config.texts)schedule();}),
  ];
  return()=>{disposed=true;clearTimeout(timer);resize?.disconnect();observed.clear();clear();expanded.clear();for(const stop of stops)stop();map.off("style.load",loaded);map.off("styledataloading",loading);map.off("sourcedata",sourced);for(const event of ["moveend","resize","click"] as const)map.off(event,schedule);containerListener(false);document.removeEventListener("visibilitychange",visibility);};
}
