import { useMemo, type ReactNode } from "react";
import { create } from "zustand";
import { Select } from "@/ui/Select";
import { Icon } from "@/ui/Icon";
import { experience } from "../experiences";
import { useExperienceStore, selectObject } from "../store";
import { useSpaceClock } from "../useClock";
import { formatValue, TIME } from "../simulation";
import { Timeline, ScenarioControls } from "../DemoPanel";
import { SeriesChart } from "../SeriesChart";
import { energyReport, irrigationReport, retailReport, trafficReport, mountainReport } from "./calculations";
import type { DemoId, Experience } from "../types";
import { exportReport } from "./exportReport";
import { FraneComparison } from "./FraneComparison";
import styles from "./Workbench.module.css";
import panel from "../Panel.module.css";
type Settings = { hours: number; scope: string; cut: number; tariff: number; target: number; root: number; efficiency: number; rain: number; reserve: number; ratio: number; staff: number; capacity: number; quota: number; lift: number };
const numeric = (n:number, unit:string) => n.toLocaleString("it-IT", unit === "€/kWh" || unit === "€" ? {minimumFractionDigits:2,maximumFractionDigits:2} : Math.abs(n)>0&&Math.abs(n)<1 ? {maximumSignificantDigits:3} : {maximumFractionDigits:["persone","addetti","veicoli"].includes(unit)?0:2});
const parameterKeys: Record<DemoId,(keyof Settings)[]> = {industry:["hours","scope","cut","tariff"],vineyard:["target","root","efficiency","rain","reserve"],retail:["hours","scope","ratio","staff"],traffic:["hours","scope","capacity"],mountain:["quota","lift"]};
const defaults: Settings = { hours:6, scope:"all", cut:10, tariff:.25, target:30, root:30, efficiency:85, rain:0, reserve:50, ratio:60, staff:4, capacity:100, quota:100, lift:850 };
const useTools = create<{ settings: Partial<Record<DemoId, Settings>>; set: (id:DemoId, patch:Partial<Settings>)=>void }>(set => ({settings:{},set:(id,patch)=>set(s=>({settings:{...s.settings,[id]:{...defaults,...s.settings[id],...patch}}}))}));
const titles: Record<DemoId, [string,string]> = {
 industry:["Bilancio energetico", "Confronta i consumi del sito o di un reparto e prova una riduzione dei carichi."],
 vineyard:["Piano irriguo", "Confronta il deficit idrico delle parcelle con una riserva e un apporto di pioggia ipotizzati."],
 retail:["Presenze e presidio", "Dimensiona un presidio dimostrativo per zona e confrontalo con i picchi recenti del modello."],
 traffic:["Laboratorio di viabilità", "Valuta l’effetto di una variazione di capacità su una sezione stradale di Tavagnacco."],
 mountain:["Accessi e coda all’impianto", "Confronta quote di accesso e capacità nominale nelle prossime due ore simulate."],
};
function Range({label,value,min,max,step=1,unit,onChange}: {label:string;value:number;min:number;max:number;step?:number;unit:string;onChange:(v:number)=>void}) {
 return <label className={styles.field}><span>{label}<output>{numeric(value,unit)} {unit}</output></span><input type="range" aria-label={label} min={min} max={max} step={step} value={value} onChange={e=>onChange(Number(e.target.value))}/></label>;
}
function Stats({rows}: {rows:[string,number|string,string?][]}) {
 return <dl className={styles.stats}>{rows.map(([label,value,unit])=><div key={label}><dt>{label}</dt><dd>{typeof value==="number"?numeric(value,unit??""):value}{unit&&<small> {unit}</small>}</dd></div>)}</dl>;
}
function Method({children}:{children:ReactNode}) {return <details className={styles.method}><summary>Ipotesi e metodo di calcolo</summary>{children}</details>;}
export function Workbench() {
 const id=useExperienceStore(s=>s.activeId);
 const scene=experience(id);
 if(!scene)return null;
 return scene.id==="landslides"?<FraneComparison/>:<DemoWorkbench key={scene.id} scene={scene}/>;
}
function DemoWorkbench({scene}:{scene:Experience}) {
 const id=scene.id as DemoId, time=useSpaceClock(), minute=Math.floor(time/TIME.MIN)*TIME.MIN;
 const scenario=useExperienceStore(s=>s.scenario), replay=useExperienceStore(s=>s.replayTime);
 const pref=useTools(s=>s.settings[id]??defaults),set=useTools(s=>s.set);
 const change=(patch:Partial<Settings>)=>set(id,patch);
 const report=useMemo(()=>{
  if(id==="industry")return energyReport(scene,minute,pref.hours,scenario,pref.cut,pref.tariff,pref.scope);
  if(id==="vineyard")return irrigationReport(scene,minute,scenario,pref.target,pref.root,pref.efficiency,pref.rain,pref.reserve);
  if(id==="retail")return retailReport(scene,minute,scenario,pref.scope,pref.ratio,pref.staff,pref.hours);
  if(id==="traffic")return trafficReport(scene,minute,scenario,Math.max(0,scene.routes.findIndex(r=>r.id===pref.scope)),pref.capacity,pref.hours);
  return mountainReport(scene,minute,scenario,pref.quota,pref.lift);
 },[id,scene,minute,pref,scenario]);
 const [title,intro]=titles[id];
 return <div className={`${panel.panel} ${styles.workbench}`} style={{"--space-tone":scene.tone} as React.CSSProperties}>
  <header className={styles.header}><Icon name="tools"/><div><h2>{title}</h2><p>{intro}</p></div></header>
  <p className={styles.notice}>Dati simulati · nessun dispositivo viene comandato.</p>
  <details className={styles.parameters}><summary>Modifica i parametri dell’ipotesi</summary><section className={styles.controls} aria-label="Parametri dello strumento">
   {["industry","retail"].includes(id)&&<label className={styles.field}>Ambito<Select label="Ambito di analisi" value={pref.scope} onChange={scope=>change({scope})} options={[{value:"all",label:"Intero sito"},...scene.zones.filter(z=>id==="retail"?z.share:scene.sensors.some(s=>s.zone===z.id&&(s.metric==="power"||s.metric==="solar"))).map(z=>({value:z.id,label:z.name}))]}/></label>}
   {id==="traffic"&&<label className={styles.field}>Sezione<Select label="Sezione stradale" value={pref.scope==="all"?scene.routes[0]!.id:pref.scope} onChange={scope=>change({scope})} options={scene.routes.map(r=>({value:r.id,label:r.name}))}/></label>}
   {["industry","retail","traffic"].includes(id)&&<label className={styles.field}>Intervallo analizzato<Select label="Intervallo analizzato" value={String(pref.hours)} onChange={v=>change({hours:Number(v)})} options={[{value:"1",label:"Ultima ora"},{value:"6",label:"Ultime 6 ore"},{value:"24",label:"Ultime 24 ore"}]}/></label>}
   {id==="industry"&&<><Range label="Riduzione ipotizzata dei carichi" value={pref.cut} min={0} max={40} unit="%" onChange={cut=>change({cut})}/><Range label="Costo ipotizzato dell’energia" value={pref.tariff} min={.05} max={.6} step={.01} unit="€/kWh" onChange={tariff=>change({tariff})}/></>}
   {id==="vineyard"&&<><Range label="Obiettivo di umidità volumetrica" value={pref.target} min={15} max={40} unit="%" onChange={target=>change({target})}/><Range label="Profondità di terreno considerata" value={pref.root} min={10} max={80} step={5} unit="cm" onChange={root=>change({root})}/><Range label="Efficienza irrigua ipotizzata" value={pref.efficiency} min={50} max={100} unit="%" onChange={efficiency=>change({efficiency})}/><Range label="Pioggia efficace ipotizzata" value={pref.rain} min={0} max={30} unit="mm" onChange={rain=>change({rain})}/><Range label="Riserva disponibile ipotizzata" value={pref.reserve} min={0} max={300} step={5} unit="m³" onChange={reserve=>change({reserve})}/></>}
   {id==="retail"&&<><Range label="Persone per addetto ipotizzato" value={pref.ratio} min={20} max={120} step={5} unit="persone" onChange={ratio=>change({ratio})}/><Range label="Addetti disponibili nell’ambito" value={pref.staff} min={0} max={40} unit="addetti" onChange={staff=>change({staff})}/></>}
   {id==="traffic"&&<Range label="Capacità disponibile rispetto alla base" value={pref.capacity} min={30} max={120} step={5} unit="%" onChange={capacity=>change({capacity})}/>}
   {id==="mountain"&&<><Range label="Quota di domanda ammessa al sito" value={pref.quota} min={30} max={100} step={5} unit="%" onChange={quota=>change({quota})}/><Range label="Capacità nominale ipotizzata" value={pref.lift} min={100} max={1200} step={50} unit="persone/h" onChange={lift=>change({lift})}/></>}
  </section></details>
  <p className={styles.asof}>Calcolo al {new Date(minute).toLocaleString("it-IT",{timeZone:"Europe/Rome",hour:"2-digit",minute:"2-digit",day:"2-digit",month:"short"})} · {replay===null?"orologio corrente":"replay"} · scenario {scene.scenarios.find(s=>s.id===scenario.id)?.title??scenario.id}. Ricomputato ogni minuto e a ogni modifica.</p>
  {id==="industry"&&<EnergyResults report={report as ReturnType<typeof energyReport>} scene={scene}/>}
  {id==="vineyard"&&<WaterResults report={report as ReturnType<typeof irrigationReport>}/>}
  {id==="retail"&&<RetailResults report={report as ReturnType<typeof retailReport>} scene={scene}/>}
  {id==="traffic"&&<TrafficResults report={report as ReturnType<typeof trafficReport>} scene={scene} routeId={pref.scope}/>} 
  {id==="mountain"&&<MountainResults report={report as ReturnType<typeof mountainReport>} scene={scene}/>}
  <details className={styles.method}><summary>Modifica istante e scenario della simulazione</summary><Timeline time={time}/><ScenarioControls scene={scene}/></details>
  <div className={styles.actions}><button onClick={()=>exportReport(id,{mode:"simulation",tool:title,space:id,asOf:new Date(minute).toISOString(),generatedAt:new Date().toISOString(),scenario,parameters:Object.fromEntries(parameterKeys[id].map(key=>[key,pref[key]])),result:report,note:"Ipotesi dimostrativa; nessun dato o comando aziendale reale. Le serie future sono proiezioni del modello sintetico, non previsioni osservate."})}><Icon name="fileData"/>Esporta ipotesi JSON</button><button onClick={()=>set(id,defaults)}>Ripristina parametri</button></div>
 </div>;
}
function EnergyResults({report:r,scene}:{report:ReturnType<typeof energyReport>;scene:Experience}) {return <>
 <Stats rows={[["Energia prelevata nel modello",r.imported,"kWh"],["Con la riduzione ipotizzata",r.planned,"kWh"],["Differenza di prelievo",r.saved,"kWh"],["Costo di acquisto ipotizzato",r.cost,"€"],["Costo nell’ipotesi",r.proposedCost,"€"],["Picco campionato prima / dopo",`${formatValue(r.peak,"kW")} / ${formatValue(r.proposedPeak,"kW")}`,"kW"]]}/>
 <SeriesChart points={r.proposal} comparison={r.baseline} comparisonLabel="Linea continua: ipotesi dello strumento · tratteggio: stessa simulazione senza la modifica." unit="kW" color={scene.tone} label="Prelievo elettrico: ipotesi e ciclo di riferimento"/>
 <Method><p>Integrazione trapezoidale dei kW ogni 5 minuti. Il fotovoltaico è sottratto solo dai carichi dello stesso ambito. L’energia esportata non diventa un prelievo negativo.</p><p>I sensori di potenza sono considerati contatori disgiunti. La riduzione uniforme riguarda i carichi virtuali già presenti nell’intervallo, senza simulare la produzione persa o lo spostamento dei turni. Il costo include soltanto i kWh acquistati alla tariffa inserita: non è una bolletta o un risparmio garantito.</p></Method>
 </>;}
function WaterResults({report:r}:{report:ReturnType<typeof irrigationReport>}) {return <>
 <Stats rows={[["Volume netto indicativo",r.net,"m³"],["Volume lordo del piano",r.gross,"m³"],["Riserva ipotizzata",r.available,"m³"],["Deficit rispetto alla riserva",r.shortfall,"m³"]]}/>
 <h3>Parcelle e priorità del piano</h3><div className={styles.rows}>{[...r.zones].sort((a,b)=>b.deficitMm-a.deficitMm).map(z=><button key={z.id} onClick={()=>selectObject(z.id)}><span><strong>{z.name}</strong><small>{z.probes} sonde · {formatValue(z.moisture,"%")}% · {formatValue(z.m2/10000,"ha")} ha</small></span><span><b>{formatValue(z.gross,"m³")} m³</b><small>{z.hours===null?"Portata nominale non disponibile":`${formatValue(z.hours,"h")} h alla portata nominale demo`}</small></span><Icon name="chevron"/></button>)}</div>
 <Method><p>Deficit = differenza tra obiettivo e umidità volumetrica media × profondità del terreno. Sottraggo la pioggia efficace inserita, poi moltiplico per l’area illustrativa e divido per l’efficienza irrigua.</p><p>Media semplice delle sonde, nessuna interpolazione del terreno. Pioggia, riserva e obiettivo sono ipotesi manuali: non previsioni meteo o prescrizioni agronomiche. I tempi usano le portate nominali dimostrative, non la portata istantanea quando la valvola è chiusa.</p></Method>
 </>;}
function RetailResults({report:r,scene}:{report:ReturnType<typeof retailReport>;scene:Experience}) {return <>
 <Stats rows={[["Presenze virtuali nell’ambito",r.current,"persone"],["Picco campionato nell’intervallo",r.peak,"persone"],["Presidio calcolato adesso",r.staffNow,"addetti"],["Presidio al picco campionato",r.staffAtPeak,"addetti"],["Addetti ipotizzati disponibili",r.onDuty,"addetti"],["Differenza da coprire ora",r.gap,"addetti"]]}/>
 <SeriesChart points={r.points} unit="persone" color={scene.tone} label="Presenze simulate nell’ambito selezionato"/>
 <div className={styles.rows}>{r.zones.map(z=><button key={z.id} onClick={()=>selectObject(z.id)}><span><strong>{z.name}</strong><small>{formatValue(z.m2,"m²")} m² illustrativi</small></span><span><b>{z.people} persone</b><small>{z.capacity?`${Math.round(z.people/z.capacity*100)}% della capienza demo`:"Capienza non configurata"}</small></span><Icon name="chevron"/></button>)}</div>
 <Method><p>Presidio = arrotondamento per eccesso di presenze / rapporto persone-addetto scelto. Il rapporto è un’ipotesi di servizio, non un requisito di sicurezza o normativo.</p><p>Il grafico campiona ogni 5 minuti; i passaggi nelle porte non sono sommati alle presenze dei negozi e non diventano visitatori unici. La capienza è illustrativa. Non deduco vendite, conversioni o identità delle persone.</p></Method>
 </>;}
function TrafficResults({report:r,scene,routeId}:{report:ReturnType<typeof trafficReport>;scene:Experience;routeId:string}) {return <>
 <Stats rows={[["Velocità prima / ipotesi",`${formatValue(r.before.speed,"km/h")} / ${formatValue(r.after.speed,"km/h")}`,"km/h"],["Coda prima / ipotesi",`${r.before.queue} / ${r.after.queue}`,"veicoli"],["Tempo sulla sezione prima",r.minutesBefore,"min"],["Tempo sulla sezione nell’ipotesi",r.minutesAfter,"min"],["Lunghezza della geometria",r.lengthKm,"km"]]}/>
 <SeriesChart points={r.proposal} comparison={r.baseline} comparisonLabel="Linea continua: ipotesi dello strumento · tratteggio: stessa simulazione senza la modifica." unit="km/h" color={scene.tone} label="Velocità simulata con variazione della capacità"/>
 <button onClick={()=>selectObject(routeId==="all"?scene.routes[0]!.id:routeId)}><Icon name="map"/>Apri la sezione stradale</button>
 <Method><p>Conservo la domanda della sezione e modifico solo la capacità disponibile nel modello esistente. La coda è un indicatore sintetico domanda-capacità, non una simulazione microscopica o una previsione del traffico.</p><p>Il tempo è lunghezza della geometria / velocità media. Non include semafori, svolte o tempi di rete e non è un ETA. OSM descrive il tracciato; nessun conteggio reale è usato qui. Le tre sezioni non vanno sommate come veicoli unici.</p></Method>
 </>;}
function MountainResults({report:r,scene}:{report:ReturnType<typeof mountainReport>;scene:Experience}) {return <>
 <Stats rows={[["Domanda nelle prossime 2 ore",r.offered,"persone"],["Accessi ammessi nell’ipotesi",r.admitted,"persone"],["Accessi differiti fuori sito",r.deferred,"persone"],["Coda finale all’impianto",r.queue,"persone"],["Picco di coda nell’ipotesi",r.peak,"persone"],["Minuti senza servizio nel modello",r.pausedMinutes,"min"]]}/>
 <SeriesChart points={r.proposal} comparison={r.baseline} comparisonLabel="Linea continua: ipotesi dello strumento · tratteggio: stessa simulazione senza la modifica." unit="persone" color={scene.tone} label="Proiezione sintetica della coda nelle prossime due ore"/>
 <Method><p>Bilancio ogni 5 minuti, con coda iniziale ipotizzata nulla: ammessi = serviti + coda residua. La domanda non ammessa è differita fuori sito, non eliminata. Non è un conteggio di persone già in attesa.</p><p>Uso i profili futuri del modello sintetico, non previsioni meteo. Nel modello il servizio è disponibile tra 07:30 e 18:00 e si sospende sopra {r.threshold} km/h sintetici. Soglia e capacità sono illustrative: non indicano apertura o sicurezza di un impianto reale.</p></Method>
 </>;}
