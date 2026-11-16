import { useEffect, useState } from "react";
import { useAppStore } from "@/app/store";
import { Icon } from "@/ui/Icon";
import { closeArea, drawArea, locateArea, useExperienceStore } from "./store";
import styles from "./AreasControl.module.css";
/** A separate entry in the map commands, with the full list in the drawer. */
export function AreasControl() {
  const active = useExperienceStore(s => s.activeId), tab = useExperienceStore(s => s.tab);
  const count = useAppStore(s => s.userPolygons.length), drawing = useAppStore(s => s.drawingMode), drawer = useAppStore(s => s.drawerOpen);
  const open = active === "landslides" && tab === "areas" && drawer && !drawing;
  useEffect(() => {
    if (!open) return;
    const frame=requestAnimationFrame(()=>{document.getElementById("drawer-panel")?.scrollTo?.({top:0});document.getElementById("saved-areas-title")?.focus({preventScroll:true});});
    return ()=>cancelAnimationFrame(frame);
  },[open]);
  if (active !== "landslides" || drawing) return null;
  return <button className={styles.head} id="areas-trigger" aria-label={`Aree · ${count}`} aria-expanded={open} aria-controls="drawer-panel" onClick={()=>{useExperienceStore.setState({tab:"areas"});useAppStore.setState({drawerOpen:!open});}}><Icon name="drawPolygon"/><span>Aree</span><b>{count}</b><Icon name="chevron"/></button>;
}
export function AreasPanel() {
  const selected = useExperienceStore(s => s.area?.id), polygons=useAppStore(s=>s.userPolygons);
  const [removing,setRemoving]=useState<string|null>(null);
  const hide = (id: string) => {
    if (selected === id) closeArea();
    else useAppStore.getState().updateUserPolygon(id, { visible: false });
  };
  return <section className={styles.collection} aria-label="Aree di lavoro">
    <h2 id="saved-areas-title" tabIndex={-1}>Le tue aree</h2>
    <div className={styles.body} id="saved-areas">
      <button className={styles.create} onClick={() => { drawArea(); }}><Icon name="plus"/>Nuova area</button>
      {!polygons.length && <p>Disegna una zona: qui ritroverai tutte le tue aree, salvate su questo dispositivo.</p>}
      <div className={styles.list}>{polygons.map(p => <div className={styles.area} key={p.id} data-selected={selected === p.id}>
        <button className={styles.name} aria-label={`Inquadra e analizza ${p.name}`} title={`Inquadra e analizza ${p.name}`} onClick={() => { locateArea(p.id); }}><i style={{ background: p.color }}/><span><strong>{p.name}</strong><small>{p.stats.areaKm2.toLocaleString("it-IT", { maximumSignificantDigits: 3 })} km² · {p.visible === false ? "nascosta" : "sulla mappa"}</small></span></button>
        <button className={styles.icon} aria-label={`${p.visible === false ? "Mostra" : "Nascondi"} ${p.name}`} onClick={() => p.visible === false ? useAppStore.getState().updateUserPolygon(p.id, { visible: true }) : hide(p.id)}><Icon name={p.visible === false ? "eyeOff" : "eye"}/></button>
        <button className={styles.icon} aria-label={`Elimina ${p.name}`} onClick={() => setRemoving(removing === p.id ? null : p.id)}><Icon name="close"/></button>
        {removing === p.id && <div className={styles.confirm}><p>Eliminare “{p.name}” dal dispositivo?</p><button onClick={() => { if (selected === p.id) closeArea(); useAppStore.getState().removeUserPolygon(p.id); setRemoving(null); requestAnimationFrame(()=>document.getElementById("saved-areas-title")?.focus({preventScroll:true})); }}>Elimina area</button><button onClick={() => setRemoving(null)}>Conserva</button></div>}
      </div>)}</div>
      {!!polygons.length && <p>Il nome richiama la zona e apre l’analisi. L’occhio nasconde il contorno senza cancellare l’area.</p>}
    </div>
  </section>;
}
