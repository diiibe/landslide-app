import { areaInSpace } from "../areaScope";
import { selectedClasses } from "@/lib/landslideClasses";
import { useMemo, useState } from "react";
import { useAppStore } from "@/app/store";
import { Select } from "@/ui/Select";
import { Icon } from "@/ui/Icon";
import { analyseArea } from "../analysis/client";
import type { AnalysisResult } from "../analysis/core";
import { AREA_PRESETS, selectArea, closeArea, useExperienceStore } from "../store";
import { areaReport, downloadAreaComparison, type AreaExportFormat } from "../analysis/exportArea";
import panel from "../Panel.module.css";
import styles from "./Workbench.module.css";
const number=(n:number)=>n.toLocaleString("it-IT",n!==0&&Math.abs(n)<.01?{maximumSignificantDigits:3,notation:Math.abs(n)<1e-6?"scientific":"standard"}:{maximumFractionDigits:2});
export function FraneComparison() {
 const saved=useAppStore(s=>s.userPolygons),current=useExperienceStore(s=>s.area);
 const options=useMemo(()=>{
  const list=[...AREA_PRESETS.map(p=>({id:p.id,name:p.name,geometry:p.geometry,saved:false})),...saved.filter(p=>areaInSpace(p,"landslides")).map(p=>({id:p.id,name:p.name,geometry:p.geometry,saved:true,spaceId:p.spaceId,color:p.color,createdAt:p.createdAt}))];
  if(current&&!list.some(p=>p.id===current.id))list.push(current);
  return list;
 },[saved,current]);
 const [a,setA]=useState("venzone"),[b,setB]=useState("gemona"),[which,setWhich]=useState<"bodies"|"diffuse">("bodies"),[min,setMin]=useState(1),[context,setContext]=useState(false);
 const [exportFormat,setExportFormat]=useState<AreaExportFormat>("csv");
 const [record,setRecord]=useState<{key:string;pending:boolean;rows:{id:string;name:string;result?:AnalysisResult;error?:string}[]}>({key:"",pending:false,rows:[]});
 const first=options.find(o=>o.id===a),second=options.find(o=>o.id===b);
 const key=JSON.stringify([first?.geometry,second?.geometry,context]);
 const compute=async()=>{
  if(!first||!second)return;
  setRecord({key,pending:true,rows:[]});
  const selections=[first,second];
  const results=await Promise.allSettled(selections.map(o=>analyseArea(o.geometry,context)));
  setRecord({key,pending:false,rows:results.map((r,i)=>({id:selections[i]!.id,name:selections[i]!.name,...(r.status==="fulfilled"?{result:r.value}:{error:r.reason instanceof Error?r.reason.message:"Analisi non disponibile"})}))});
 };
 const shown=record.key===key?record.rows:[];
 return <div className={`${panel.panel} ${styles.workbench}`}>
  <header className={styles.header}><Icon name="areaData"/><div><h2>Confronta due zone</h2><p>Confronta copertura, classi della mappatura ed esposizione delle reti. Puoi usare anche le zone che hai disegnato e salvato.</p></div></header>
  <button onClick={()=>{closeArea();useExperienceStore.setState({tab:"overview"});useAppStore.setState({drawerOpen:false});}}><Icon name="close"/>Chiudi confronto e contorno</button>
  <p className={styles.notice}>Mappatura versionata · non è un monitoraggio dei movimenti.</p>
  <div className={styles.controls}>
   <label className={styles.field}>Prima zona<Select label="Prima zona da confrontare" value={a} onChange={setA} options={options.map(o=>({value:o.id,label:o.name}))}/></label>
   <label className={styles.field}>Seconda zona<Select label="Seconda zona da confrontare" value={b} onChange={setB} options={options.map(o=>({value:o.id,label:o.name}))}/></label>
   <label className={styles.field}>Mappatura<Select label="Mappatura del confronto" value={which} onChange={v=>setWhich(v as "bodies"|"diffuse")} options={[{value:"bodies",label:"Corpi di frana"},{value:"diffuse",label:"Franosità diffusa"}]}/></label>
   <label className={styles.field}>Grado minimo · fascia alta<Select label="Grado minimo nella fascia alta" value={String(min)} onChange={v=>setMin(Number(v))} options={[1,2,3,4,5].map(n=>({value:String(n),label:`Dal grado ${n} · fascia alta`}))}/></label>
   <label className={styles.check}><input type="checkbox" checked={context} onChange={e=>setContext(e.target.checked)}/>Includi strade e sentieri completi</label>
  </div>
  <button className={panel.primary} disabled={!first||!second||a===b||record.pending} onClick={()=>void compute()}><Icon name="tools"/>{record.pending?"Calcolo delle intersezioni…":"Calcola confronto"}</button>
  {a===b&&<p role="status">Seleziona due zone diverse per confrontarle.</p>}
  <p className={styles.asof}>{context?"La prima analisi delle reti scarica circa 18 MB di indici, poi li riusa nella sessione.":"Intersezioni reali sulla griglia originale da 120 m; le celle di bordo sono pesate per superficie."}</p>
  {record.pending&&<p role="status">Analisi completa delle zone, indipendente dall’inquadratura della mappa…</p>}
  {!!record.rows.length&&record.key!==key&&<p role="status">Le zone o le fonti richieste sono cambiate. Ricalcola per aggiornare il confronto.</p>}
  {shown.map(row=>{
   const result=row.result,l=result?.layers[which];
   const above=l?.classes.slice(min-1).reduce((s,n)=>s+n,0)??0;
   const roads=result?.networks?.roads,trails=result?.networks?.trails;
   const length=(n:typeof roads)=>n?(which==="bodies"?n.bodiesKm:n.diffuseKm).slice(min).reduce((s,v)=>s+v,0):null;
   return <section key={row.id} className={styles.result} aria-label={`Confronto zona ${row.name}`}><h3>{row.name}</h3>{row.error?<p role="alert">{row.error}</p>:result&&l&&<>
    <dl className={styles.stats}>
     <div><dt>Superficie totale</dt><dd>{number(result.areaM2/1e6)} <small>km²</small></dd></div>
     <div><dt>Copertura della mappatura</dt><dd>{number(l.coveredM2/result.areaM2*100)}%</dd></div>
     <div><dt>Area mappata in classi ≥ {min}</dt><dd>{l.coveredM2?number(above/l.coveredM2*100)+"%":"Non disponibile"}</dd></div>
     <div><dt>Superficie in classi ≥ {min}</dt><dd>{l.coveredM2?number(above/1e6)+" km²":"Non disponibile"}</dd></div>
     {context&&<><div><dt>Strade in classi ≥ {min}</dt><dd>{length(roads)===null?"Non disponibile":number(length(roads)!)+" km"}</dd></div><div><dt>Sentieri in classi ≥ {min}</dt><dd>{length(trails)===null?"Non disponibile":number(length(trails)!)+" km"}</dd></div></>}
    </dl>{!!l.belowFocusM2&&<p className={styles.asof}>{number(l.belowFocusM2/1e6)} km² mappati sotto la fascia alta, distinti dai dati mancanti.</p>}<p className={styles.asof}>Indice {result.version??"versione non dichiarata"}. Senza mappatura: {number(Math.max(0,result.areaM2-l.coveredM2)/1e6)} km²; esclusi dalle percentuali di classe.</p>
    <button onClick={()=>{const area=options.find(o=>o.id===row.id);if(area){selectArea(area);useExperienceStore.setState({analysisLayer:which});const mapKey=which==="bodies"?"v2Bodies":"v2Diffuse";if(!useAppStore.getState().layers[mapKey])useAppStore.getState().toggleLayer(mapKey);const ring=area.geometry.coordinates[0]!;window.dispatchEvent(new CustomEvent("fvg:regional-fit",{detail:[[Math.min(...ring.map(p=>p[0]!)),Math.min(...ring.map(p=>p[1]!))],[Math.max(...ring.map(p=>p[0]!)),Math.max(...ring.map(p=>p[1]!))]]}));}}}><Icon name="map"/>Apri analisi e mappa della zona</button>
   </>}</section>;
  })}
  {shown.length===2&&shown.every(r=>r.result)&&<section className={styles.controls} aria-label="Esporta confronto">
    <label className={styles.field}>Formato del confronto<Select label="Formato esportazione confronto" value={exportFormat} onChange={v=>setExportFormat(v as AreaExportFormat)} options={[{value:"csv",label:"CSV · tabelle e unità"},{value:"geojson",label:"GeoJSON · entrambi i perimetri e dati"},{value:"html",label:"Relazione · leggibile e stampabile"},{value:"json",label:"JSON · risultati completi"}]}/></label>
    <button onClick={()=>downloadAreaComparison(exportFormat,shown.flatMap(row=>{const area=options.find(o=>o.id===row.id);return area&&row.result?[areaReport(area,row.result,{bodies:selectedClasses(useAppStore.getState().susceptibilityStyle.bodies),diffuse:selectedClasses(useAppStore.getState().susceptibilityStyle.diffuse)})]:[];}),{layer:which,minClass:min})}><Icon name="fileData"/>Esporta confronto {exportFormat.toUpperCase()}</button>
    <p className={styles.asof}>Geometrie e risultati restano separati per zona. Il GeoJSON può essere reimportato come due aree; la relazione si stampa in PDF dal browser. Le quote usano la parte mappata di ciascuna zona.</p>
  </section>}
  <details className={styles.method}><summary>Come confrontare zone diverse</summary><p>Una quota alta di classi superiori descrive la porzione mappata, non tutta la superficie. Considera sempre la copertura e le aree prive di dati. Le lunghezze sono indicatori esplorativi: reti OSM semplificate e classificate per segmenti, non verifiche di transitabilità.</p><p>Questo strumento non crea graduatorie automatiche di rischio e non sostituisce valutazioni tecniche sul territorio.</p></details>
 </div>;
}
