import { useAppStore } from "@/app/store";
import { useExperienceStore } from "./store";
import { networkMapping } from "./contextNetworks";
import { v2ClassColor } from "@/map/layers/modelV2";
import { selectedClasses } from "@/lib/landslideClasses";
import styles from "./NetworkKey.module.css";
export function NetworkKey() {
  const layers=useAppStore(s=>s.layers), settings=useAppStore(s=>s.susceptibilityStyle), preferred=useExperienceStore(s=>s.analysisLayer);
  const activeSpace=useExperienceStore(s=>s.activeId);
  const which=networkMapping({layers},preferred,activeSpace), both=which!==null&&layers.v2Bodies&&layers.v2Diffuse;
  const chosen=which?selectedClasses(settings[which]):[];
  return <section className={styles.key} aria-label="Colori di strade e sentieri">
    <strong>Strade e sentieri{which ? ` · ${which==="bodies" ? "corpi di frana" : "franosità diffusa"}` : " · contesto"}</strong>
    {both && <div className={styles.switch} role="group" aria-label="Mappatura delle reti">{([['bodies','Corpi di frana'],['diffuse','Franosità diffusa']] as const).map(([id,label])=><button key={id} aria-pressed={preferred===id} onClick={()=>useExperienceStore.setState({analysisLayer:id})}>{label}</button>)}</div>}
    {which && <ol>{[1,2,3,4,5].map(c=><li key={c}><i style={{background:v2ClassColor(c,5),opacity:chosen.includes(c)?1:.25}}/><span>{c}</span></li>)}</ol>}
    <p>{which ? "Stessi gradi e colori della mappatura indicata. Le classi disattivate restano grigie. Grigio ≠ sicurezza: include tratti fuori fascia o senza dati. Campionamento fino a 60 m." : activeSpace==="landslides" ? "Nessuna mappatura frane attiva: la rete è neutra. Grigio ≠ sicurezza." : "Rete di contesto neutra. La colorazione della suscettibilità si applica solo nello Spazio Frane."}</p>
  </section>;
}
