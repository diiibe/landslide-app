import { useAppStore } from "@/app/store";
import { useRegionalStore } from "@/regional/store";
import { BUILTIN_LAYERS, isLayerEnabled } from "@/regional/builtins";
import { useTwinStore } from "@/digital-twin/store";
import { ageLabel, formatTime, variableMeasures } from "@/digital-twin/data";
import { useExperienceStore } from "./store";
import { useSpaceClock } from "./useClock";
import styles from "./SpaceDataStatus.module.css";
export function SpaceDataStatus() {
 const active=useExperienceStore(s=>s.activeId), replay=useExperienceStore(s=>s.replayTime), clock=useSpaceClock(true);
 const regional=useRegionalStore(), twin=useTwinStore();
 useAppStore(s=>s.layers);
 if(!active)return null;
 const layers=[...new Map([...BUILTIN_LAYERS,...(regional.catalog?.layers??[])].map(l=>[l.id,l])).values()].filter(l=>isLayerEnabled(l));
 const shown=replay??clock;
 return <section className={styles.status} aria-label="Stato e aggiornamento dei dati">
  <div className={styles.line}><strong>{active==="landslides"?"Mappatura reale versionata":replay===null?"Simulazione in corso":"Replay della simulazione"}</strong>{active!=="landslides"&&<time dateTime={new Date(shown).toISOString()}>{new Date(shown).toLocaleTimeString("it-IT",{timeZone:"Europe/Rome",hour:"2-digit",minute:"2-digit",second:"2-digit"})} · Roma</time>}</div>
  <details><summary>Catalogo e aggiornamenti · {layers.length} livelli attivi</summary>
   <p>{active==="landslides"?"La mappa delle frane è un modello pubblicato, non un rilevamento di frane in corso. La prima analisi dopo ogni accesso verifica la versione dell’indice; se è cambiata, viene ricaricata.":"Le misure della demo sono generate dall’orologio: nessun sensore aziendale è collegato. In riapertura viene ricostruito lo stato corrente; il replay conserva il suo istante."}</p>
   {!layers.length&&<p>Nessuna fonte aggiuntiva del catalogo attiva. Puoi aggiungerla dalla scheda Livelli, separatamente dai dati propri dello Spazio.</p>}
   <ul>{layers.map(l=>{
    const e=regional.entries[l.id],feed=l.pcrVariable?twin.sensorsFeed:l.kind==="radar"?twin.radarFeed:null;
    const observations=l.pcrVariable?variableMeasures(twin.measures,l.pcrVariable).map(m=>m.ms):l.kind==="radar"&&twin.radar?[twin.radar.ms]:e?.data?.features.map(f=>Date.parse(String(f.properties?.__observedAt))).filter(Number.isFinite)??[];
    const latest=observations.length?observations.reduce((a,b)=>Math.max(a,b),-Infinity):null;
    const error=e?.error??feed?.error??l.refreshError;
    const snapshot=e?.snapshot??feed?.snapshot??false;
    return <li key={l.id}><strong>{l.title}</strong><span>{error?"Aggiornamento non riuscito · dati precedenti, se disponibili":snapshot?"Copia salvata":e?.loading||feed?.loading?"Verifica della fonte…":l.live||l.pollUrl||l.pcrVariable||l.kind==="radar"?"Fonte ricontrollata automaticamente":"Archivio / dato versionato"}</span>{latest!==null&&<span>Ultima osservazione: {formatTime(latest)} · {ageLabel(latest,clock)}</span>}<small>{l.cadence}{l.retrievedAt?` · acquisizione ${formatTime(Date.parse(l.retrievedAt))}`:""}</small></li>;
   })}</ul>
   <p>Le fonti osservative vengono ricontrollate ogni 60 secondi mentre la pagina è visibile, anche al ritorno online o nella scheda. La data della misura può essere precedente: dipende dalla cadenza e dalla disponibilità della fonte. Il catalogo è verificato ogni 5 minuti; gli archivi seguono gli aggiornamenti pubblicati.</p>
   <button onClick={()=>{useTwinStore.setState(s=>({autoRefresh:true,refreshKey:s.refreshKey+1}));useRegionalStore.setState(s=>({refreshKey:s.refreshKey+1}));}}>Ricontrolla fonti osservative</button>
  </details>
 </section>;
}
