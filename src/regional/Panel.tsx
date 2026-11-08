import{useEffect,useRef,useState,type CSSProperties,type ReactNode}from 'react';
import{useAppStore}from '@/app/store';
import{LayersPanel}from '@/map-overlays/LayersPanel';
import{TwinPanel,Series}from '@/digital-twin/Panel';
import{useTwinStore}from '@/digital-twin/store';
import{ageLabel,formatTime,formatValue,variableMeasures}from '@/digital-twin/data';
import{BUILTIN_LAYERS,enableLayer,isLayerEnabled}from './builtins';
import{setRegionalOpacity,toggleFolder,useRegionalStore}from './store';
import{metricRange,defaultOpacity}from './data';
import{FOLDERS,type FolderId,type LayerDefinition}from './types';
import styles from './Panel.module.css';

const normal=(s:string)=>s.toLocaleLowerCase('it').normalize('NFD').replace(/\p{Diacritic}/gu,'');
function date(value?:string){if(!value)return'Non indicata dalla fonte';const ms=Date.parse(value);return Number.isFinite(ms)?new Date(ms).toLocaleDateString('it-IT',{timeZone:'Europe/Rome'}):value;}
function closeOnMobile(){if(window.matchMedia('(max-width: 768px), (max-height: 500px) and (pointer: coarse)').matches)useAppStore.setState({drawerOpen:false});}
export function LayerButton(){const open=useAppStore(s=>s.drawerOpen);return<button type="button" className={styles.layerTrigger} aria-expanded={open} aria-controls="drawer-panel" onClick={()=>{useRegionalStore.setState({tab:'layers'});useAppStore.setState({drawerOpen:!open});}}>Livelli e dati</button>;}
export function RegionalPanel({analysis}:{analysis:ReactNode}){
 const state=useRegionalStore(),twin=useTwinStore(),ref=useRef<HTMLDivElement>(null);
 const layers=[...BUILTIN_LAYERS.filter(b=>!state.catalog?.layers.some(l=>l.id===b.id)),...(state.catalog?.layers??[])];
 const selected=twin.selection?layers.find(l=>l.id===(twin.selection?.kind==='sensor'?'pcr-'+twin.variable:twin.selection?.kind==='asset'?'twin-aia':'twin-buildings')):layers.find(l=>l.id===(state.selection?.layerId??state.detailId));
 const selectedId=selected?.id;
 useEffect(()=>{if(selectedId&&state.tab==='layers')ref.current?.scrollIntoView?.({block:'start'});},[selectedId,state.selection,twin.selection,state.tab]);
 const query=normal(state.query.trim()),filtered=layers.filter(l=>(!state.activeOnly||isLayerEnabled(l))&&(!query||normal([l.title,l.description,l.sourceId,l.provider,FOLDERS[l.folder],l.subfolder??''].join(' ')).includes(query)));
 const legacy=useAppStore(s=>s.layers),userLayers=useAppStore(s=>s.userLayers);
 const active=layers.filter(isLayerEnabled).length+Object.values(legacy).filter(Boolean).length+userLayers.filter(l=>l.visible).length,blocked=state.catalog?.layers.filter(l=>l.status==='blocked')??[];
 const details=(l:LayerDefinition)=>{useTwinStore.setState({selection:null,...(l.pcrVariable?{variable:l.pcrVariable}:{})});useRegionalStore.setState({detailId:l.id,selection:null});};
 const renderFolder=(folder:FolderId)=>{const list=filtered.filter(l=>l.folder===folder);if(!list.length)return null;return<Folder key={folder} id={folder} label={FOLDERS[folder]} layers={list} forceOpen={!!query} onDetails={details}/>;};
 const refresh=()=>{useRegionalStore.setState(s=>({refreshKey:s.refreshKey+1}));useTwinStore.setState(s=>({refreshKey:s.refreshKey+1}));};
 return<div className={styles.panel}>
  <div className={styles.toolbar}>
   <div className={styles.tabs} role="tablist" aria-label="Pannello della mappa">
    <button role="tab" id="layers-tab" aria-controls="regional-layers-panel" aria-selected={state.tab==='layers'} onClick={()=>useRegionalStore.setState({tab:'layers'})}>Livelli</button>
    <button role="tab" id="analysis-tab" aria-controls="regional-analysis-panel" aria-selected={state.tab==='analysis'} onClick={()=>useRegionalStore.setState({tab:'analysis'})}>Analisi</button>
   </div>
   {state.tab==='layers'&&<><label className={styles.field}>Cerca un livello<input type="search" placeholder="Dato, fonte o cartella" value={state.query} onChange={e=>useRegionalStore.setState({query:e.target.value})}/></label><div className={styles.actions}><button type="button" aria-pressed={!state.activeOnly} onClick={()=>useRegionalStore.setState({activeOnly:false})}>Tutti</button><button type="button" aria-pressed={state.activeOnly} onClick={()=>useRegionalStore.setState({activeOnly:true})}>Attivi · {active}</button></div><p className={styles.caption}>Una mappa · livelli indipendenti. Attiva solo i dati che vuoi confrontare.</p></>}
  </div>
  {state.tab==='analysis'?<section role="tabpanel" id="regional-analysis-panel" aria-labelledby="analysis-tab">{analysis}</section>:<section role="tabpanel" id="regional-layers-panel" aria-labelledby="layers-tab">
   {selected&&<div ref={ref} className={styles.detail}><div className={styles.detailHead}><h2>{selected.title}</h2><button type="button" onClick={()=>{useRegionalStore.setState({detailId:null,selection:null});useTwinStore.setState({selection:null});}}>Chiudi dettaglio</button></div>{selected.kind==='pcr'||selected.kind==='aia'||selected.kind==='buildings'?<>{(twin.selection||selected.pcrVariable)&&<TwinPanel inspectorOnly/>}<LayerInfo layer={selected}/></>:<LayerInfo layer={selected}/>}</div>}
   <LayersPanel embedded query={state.query} activeOnly={state.activeOnly} contextExtra={filtered.some(l=>l.folder==='contesto')?<Rows layers={filtered.filter(l=>l.folder==='contesto')} onDetails={details}/>:null} contextStats={{active:filtered.filter(l=>l.folder==='contesto'&&isLayerEnabled(l)).length,total:filtered.filter(l=>l.folder==='contesto').length}}/>
   {(Object.keys(FOLDERS)as FolderId[]).filter(id=>id!=='contesto').map(renderFolder)}
   {!filtered.length&&<p className={styles.empty}>Nessun livello regionale corrisponde alla ricerca. Frane, alluvioni e contesto restano nelle cartelle iniziali.</p>}
   {!state.catalog&&!state.catalogError&&<p role="status">Caricamento del catalogo regionale…</p>}
   {state.catalogError&&<p className={styles.error}>Catalogo: {state.catalogError}. <button onClick={refresh}>Riprova</button></p>}
   <details className={styles.review}><summary>Fonti e aggiornamenti automatici</summary><p className={styles.caption}>Sensori: verifica ogni minuto durante la consultazione. Registri e cartografie: sincronizzazione programmata ogni {state.catalog?.refreshHours??6} ore. La frequenza della fonte rimane quella dichiarata in ogni scheda.</p><p className={styles.caption}>Catalogo generato: {state.catalog?formatTime(Date.parse(state.catalog.generatedAt)):'In attesa'}. Le schede riportano la data effettiva di acquisizione e l’eventuale errore dell’ultimo aggiornamento.</p><button onClick={refresh}>Verifica adesso</button><p className={styles.caption}>Le schede nascoste sospendono il polling. Alla riapertura riparte la verifica. I dati salvati restano identificati con la propria data.</p></details>
   {!!blocked.length&&<details className={styles.review}><summary>Da revisionare · {blocked.length}</summary><p className={styles.caption}>Questi dati non sono presentati come livelli importati.</p>{blocked.map(l=><article key={l.id}><strong>{l.title}</strong><p className={styles.caption}>{l.problem}</p><a href={l.sourceUrl} target="_blank" rel="noreferrer">Fonte</a></article>)}</details>}
  </section>}
 </div>;
}
function Folder({id,label,layers,forceOpen=false,onDetails}:{id:string;label:string;layers:LayerDefinition[];forceOpen?:boolean;onDetails:(l:LayerDefinition)=>void}){
 const s=useRegionalStore(),open=forceOpen||!!s.open[id];const active=layers.filter(isLayerEnabled).length;
 const groups=new Map<string,LayerDefinition[]>();for(const l of layers){const key=l.subfolder??'';groups.set(key,[...(groups.get(key)??[]),l]);}
 return<section className={styles.folder}><button className={styles.folderHead} aria-expanded={open} aria-controls={'folder-'+id} onClick={()=>toggleFolder(id)}><span>{open?'▾':'▸'} {label}</span><span>{active} / {layers.length}</span></button>{open&&<div className={styles.folderBody} id={'folder-'+id}>{groups.size>1?[...groups].map(([group,list])=>group?<div className={styles.nested} key={group}><Folder id={id+'-'+list[0]!.sourceId} label={group} layers={list.map(l=>{const next={...l};delete next.subfolder;return next;})} forceOpen={forceOpen} onDetails={onDetails}/></div>:<Rows key="plain" layers={list} onDetails={onDetails}/>):<Rows layers={layers} onDetails={onDetails}/>}</div>}</section>;
}
function Rows({layers,onDetails}:{layers:LayerDefinition[];onDetails:(l:LayerDefinition)=>void}){
 const[limit,setLimit]=useState(30);useRegionalStore(s=>s.enabled);useRegionalStore(s=>s.entries);useTwinStore(s=>s.measures);useTwinStore(s=>s.sensorsFeed);useTwinStore(s=>s.radar);useTwinStore(s=>s.radarFeed);
 return<>{layers.slice(0,limit).map(l=><div key={l.id} className={styles.row}><label><input type="checkbox" aria-label={l.title} disabled={l.status!=='ready'} checked={isLayerEnabled(l)} onChange={e=>enableLayer(l,e.target.checked)}/><i className={styles.swatch} style={{background:l.color}} aria-hidden="true"/><span><strong>{l.title}</strong><small>{rowStatus(l)}</small></span></label><button aria-label={'Dettagli · '+l.title} onClick={()=>onDetails(l)}>Info</button></div>)}{layers.length>limit&&<button onClick={()=>setLimit(n=>n+30)}>Mostra altri {Math.min(30,layers.length-limit)} · {layers.length-limit} rimanenti</button>}</>;
}
function rowStatus(l:LayerDefinition){
 if(l.status!=='ready')return'Da revisionare';const e=useRegionalStore.getState().entries[l.id];
 if(l.kind==='radar'){const s=useTwinStore.getState();return s.radarFeed.error?'Errore fonte · apri Info':s.radarFeed.snapshot?'Snapshot salvato · apri Info':s.radar?'Radar · '+ageLabel(s.radar.ms):'In attesa del prodotto radar';}
 if(l.pcrVariable){const s=useTwinStore.getState(),rows=variableMeasures(s.measures,l.pcrVariable);const latest=Math.max(0,...rows.map(m=>m.ms));return `${rows.length} stazioni${latest?' · '+ageLabel(latest):s.sensorsFeed.loading?' · lettura fonte…':''}${s.sensorsFeed.error?' · fonte non raggiunta':''}`;}
 if(e?.loading)return'Caricamento…';if(l.liveKind==='pcr'&&e?.data)return e.data.features.length+' stazioni con osservazioni';if((l.live||l.pollUrl)&&e?.data){const times=e.data.features.map(f=>Date.parse(String(f.properties?.__observedAt))).filter(Number.isFinite);return e.data.features.length+' punti osservati'+(times.length?' · '+ageLabel(Math.max(...times)):'');}if(e?.error)return'Errore fonte · apri Info';if(l.refreshError)return'Ultimo aggiornamento fallito · dato conservato';
 return[l.count!==undefined?l.count.toLocaleString('it-IT')+' elementi':l.live?'Osservazioni OGS':null,l.dataDate?'Dato: '+date(l.dataDate):l.cadence].filter(Boolean).join(' · ');
}
function LayerInfo({layer:l}:{layer:LayerDefinition}){
 const radar=useTwinStore(s=>s.radar),radarFeed=useTwinStore(s=>s.radarFeed);
 const s=useRegionalStore(),selection=s.selection?.layerId===l.id?s.selection:null,entry=s.entries[l.id];
 const selected=selection&&(entry?.data?.features.find(f=>f.properties?.__featureId===selection.feature.properties?.__featureId)??selection.feature);const p=selected?.properties;
 const range=metricRange(l,entry?.data),depths=entry?.data?[...new Set(entry.data.features.map(f=>f.properties?.__depth).filter(v=>v!==undefined&&v!==''&&v!==null).map(String))].sort((a,b)=>Number(a)-Number(b)):[];
 const fit=()=>{if(l.pcrVariable){useTwinStore.setState({variable:l.pcrVariable});window.dispatchEvent(new CustomEvent('fvg:twin-fit'));}else if(l.bounds)window.dispatchEvent(new CustomEvent('fvg:regional-fit',{detail:l.bounds}));closeOnMobile();};
 return<>
  {l.kind==='radar'&&<><p className={styles.caption}>{radar?'Ora del prodotto: '+formatTime(radar.ms):'Nessuna immagine radar disponibile.'}</p>{radarFeed.loading&&<p role="status">Verifica del radar…</p>}{radarFeed.error&&<p className={styles.error}>Fonte non raggiunta: {radarFeed.error}. L’eventuale immagine conservata mantiene la propria data.</p>}{radarFeed.snapshot&&<p className={styles.caption}>Snapshot salvato; non è una conferma del radar corrente.</p>}</>}
  {p&&<><h3>{String(p.__name??'Elemento selezionato')}</h3>{(p.__displayValue!==undefined||p.__value!==undefined)&&<div className={styles.value}>{typeof p.__value==='number'&&!p.__censored?formatValue(p.__value):String(p.__displayValue??'')} <span>{String(p.__unit??l.metric?.unit??'')}</span></div>}{p.__observedAt&&<p className={styles.caption}>Osservazione: {(l.live||l.pollUrl||l.liveKind==='pcr')?formatTime(Date.parse(String(p.__observedAt))):date(String(p.__observedAt))}</p>}{p.__depth!==undefined&&p.__depth!==''&&<p>Profondità nella fonte: {String(p.__depth)} m</p>}{p.qualita&&<p className={styles.caption}>Qualità: {String(p.qualita)} · QC {String(p.qualita_qc)}</p>}{p.__censored&&<p className={styles.caption}>Limite analitico: il valore censurato non è stato convertito in una concentrazione misurata.</p>}</>}
  {l.liveKind==='pcr'&&p&&typeof p.stationId==='number'&&typeof p.sensorId==='number'&&typeof p.__value==='number'&&<Series measure={{stationId:p.stationId,sensorId:p.sensorId,name:String(p.__name),lon:selected?.geometry.type==='Point'?selected.geometry.coordinates[0]!:0,lat:selected?.geometry.type==='Point'?selected.geometry.coordinates[1]!:0,value:p.__value,time:String(p.__observedAt),ms:Date.parse(String(p.__observedAt))}} unitOverride={l.metric?.unit??''}/>}
  <p>{l.description}</p><p className={styles.caption}>{l.note}</p>
  {l.status==='blocked'?<p className={styles.error}>{l.problem}</p>:<><label className={styles.checks}><input type="checkbox" checked={isLayerEnabled(l)} onChange={e=>enableLayer(l,e.target.checked)}/>Mostra questo livello</label><label className={styles.field}>Opacità · {Math.round((s.opacity[l.id]??defaultOpacity(l))*100)}%<input type="range" min="0" max="1" step="0.05" value={s.opacity[l.id]??defaultOpacity(l)} onChange={e=>setRegionalOpacity(l.id,Number(e.target.value))}/></label></>}
  {range&&<div className={styles.scale} style={{'--layer-color':l.color}as CSSProperties}><span>{formatValue(range[0])}</span><i aria-hidden="true"/><span>{formatValue(range[1])} {l.metric?.unit}</span></div>}
  {depths.length>1&&<label className={styles.field}>Profondità nella fonte<select value={s.filters[l.id]??''} onChange={e=>useRegionalStore.setState(st=>({filters:{...st.filters,[l.id]:e.target.value}}))}><option value="">Tutte le profondità</option>{depths.map(d=><option key={d} value={d}>{Number.isFinite(Number(d))?formatValue(Number(d)):d} m</option>)}</select></label>}
  {(l.bounds||l.pcrVariable)&&<button onClick={fit}>Inquadra il livello</button>}
  {entry?.loading&&<p role="status" className={styles.caption}>Lettura dei dati…</p>}
  {(entry?.error||l.refreshError)&&<p className={styles.error}>Aggiornamento non riuscito: {entry?.error??l.refreshError}. {entry?.data?'Conservo i dati disponibili con la loro data.':''}</p>}
  {entry?.snapshot&&(l.live||l.pollUrl)&&<p className={styles.caption}>Snapshot salvato; la fonte corrente non è disponibile.</p>}
  <details><summary>Fonte, date e copertura</summary><dl className={styles.metadata}><div><dt>Fonte</dt><dd>{l.provider} · <a href={l.sourceUrl} target="_blank" rel="noreferrer">{l.sourceId}</a></dd></div><div><dt>Aggiornamento</dt><dd>{l.cadence}</dd></div><div><dt>Acquisizione dei dati salvati</dt><dd>{l.retrievedAt?formatTime(Date.parse(l.retrievedAt)):'Vedi fonte e provenienza del livello'}</dd></div>{l.dataDate&&<div><dt>Data del dato</dt><dd>{date(l.dataDate)}</dd></div>}<div><dt>Licenza</dt><dd><a href={l.licenseUrl} target="_blank" rel="noreferrer">{l.license}</a></dd></div>{l.count!==undefined&&<div><dt>Copertura</dt><dd>{l.count.toLocaleString('it-IT')} geometrie visualizzabili{l.sourceCount!==undefined?' · '+l.sourceCount.toLocaleString('it-IT')+' righe della fonte nella finestra acquisita':''}</dd></div>}</dl>{l.warnings?.map(w=><p key={w} className={styles.caption}>{w}</p>)}</details>
  {p&&<details><summary>Attributi della fonte</summary><dl className={styles.metadata}>{Object.entries(p).filter(([k,v])=>!k.startsWith('__')&&v!==null&&v!=='').map(([k,v])=><div key={k}><dt>{k.replaceAll('_',' ')}</dt><dd>{String(v)}</dd></div>)}</dl></details>}
 </>;
}
