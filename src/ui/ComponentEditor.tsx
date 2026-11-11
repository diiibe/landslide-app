import { useState } from "react";
import { Select } from "./Select";
import { Icon } from "./Icon";
import { COMPONENTS, UI_TEXT, contrastText, useInterfaceSettings, type ComponentId, type ComponentStyle, type TextId } from "./interfaceSettings";
import styles from "./ComponentEditor.module.css";
const defaults: Required<Omit<ComponentStyle,"background"|"text"|"border">> = { opacity:100,shade:0,texture:"none",intensity:10,font:"manrope",size:14,weight:500,radius:6,depth:1 };
function currentColour(component:ComponentId,property:"backgroundColor"|"color"|"borderColor",fallback:string) {
  const el=document.querySelector<HTMLElement>(`[data-ui="${component}"]`);
  const computed=el?getComputedStyle(el):null;
  const borderSide=computed?["Top","Right","Bottom","Left"].find(side=>parseFloat(computed.getPropertyValue("border-"+side.toLowerCase()+"-width"))>0):undefined;
  const colour=computed ? (property==="borderColor"&&borderSide?computed.getPropertyValue("border-"+borderSide.toLowerCase()+"-color"):computed[property]) : getComputedStyle(document.documentElement).getPropertyValue(property==="backgroundColor"?"--c-surface-raised":property==="color"?"--c-text":"--c-border-strong");
  if(/^rgba?\(/.test(colour)) {
    const rgb=colour.match(/\d+(\.\d+)?/g);
    if(rgb&&rgb.length>=3)return "#"+rgb.slice(0,3).map(x=>Math.round(Number(x)).toString(16).padStart(2,"0")).join("");
  }
  // Tokens use OKLCH / color(srgb) in native browsers. Canvas resolves those
  // spaces correctly; parsing their decimal channels as RGB bytes does not.
  if(!colour||colour==="transparent")return fallback;
  const canvas=document.createElement("canvas");canvas.width=canvas.height=1;
  const context=canvas.getContext("2d");if(!context)return fallback;
  context.fillStyle=colour;context.fillRect(0,0,1,1);
  const rgba=context.getImageData(0,0,1,1).data;
  return "#"+Array.from(rgba).slice(0,3).map(x=>x.toString(16).padStart(2,"0")).join("");
}
export function ComponentEditor({component}:{component:ComponentId}) {
  const {config,setStyle,reset}=useInterfaceSettings();
  const item=COMPONENTS.find(i=>i.id===component)!,custom=config.components[component]??{};
  const defaultTexture=["navbar","drawer","catalog"].includes(component)?"territory":"none";
  const values={...defaults,texture:defaultTexture,...custom};
  const base={background:currentColour(component,"backgroundColor","#d7e1d2"),text:currentColour(component,"color","#202b24"),border:currentColour(component,"borderColor","#a4b5a1")};
  const change=(patch:Partial<ComponentStyle>)=>setStyle(component,patch);
  const slider=(key:"opacity"|"shade"|"intensity"|"size"|"weight"|"radius"|"depth",label:string,min:number,max:number,step:number,unit:string)=> <label className={styles.field}><span>{label}<output>{values[key]}{unit}</output></span><input type="range" aria-label={`${label} · ${item.name}`} min={min} max={max} step={step} value={values[key]} onChange={e=>change({[key]:Number(e.target.value)})}/></label>;
  const textKeys=(Object.keys(UI_TEXT) as TextId[]).filter(id=>UI_TEXT[id].component===component);
  return <>
    <div className={styles.title}><div><h2>{item.name}</h2><p>{item.note}</p></div><button type="button" onClick={()=>reset(component)} aria-label={`Ripristina ${item.name}`}><Icon name="recycle" /><span>Ripristina</span></button></div>
    <section className={styles.previewFrame} aria-label={`Anteprima ${item.name}`}>
      <div className={styles.preview} data-ui={component}>
        <Icon name={component==="sensor"?"sensor":"layers"}/><strong>{component==="navbar" ? config.texts.brand??"FriulView" : item.name}</strong>
        <span>{component==="sensor"?"Temperatura · 18,4 °C · esempio grafico":"Anteprima del componente"}</span>
      </div>
      <small>Anteprima immediata · modifica applicata anche nell’app</small>
    </section>
    <fieldset className={styles.section}><legend>Colori e superficie</legend><div className={styles.colours}>
      {([['background','Fondo'],['text','Testo'],['border','Bordo']] as const).map(([key,label])=><label key={key}><span>{label}</span><input type="color" aria-label={`${label} · ${item.name}`} value={custom[key]??(key==="text"&&custom.background?contrastText(custom.background):base[key])} onChange={e=>change({[key]:e.target.value})}/><code>{custom[key]??(key==="text"&&custom.background?contrastText(custom.background):base[key])}</code></label>)}
    </div><p className={styles.hint}>Quando cambi il fondo, il testo si adatta finché non scegli un colore del testo. I colori delle misure restano quelli della fonte.</p><div className={styles.grid}>{slider("opacity","Opacità fondo",70,100,1,"%")} {slider("shade","Sfumatura di luce",0,30,1,"%")} {slider("depth","Profondità",0,3,1,"")} {slider("radius","Angoli",0,16,1," px")}</div></fieldset>
    <fieldset className={styles.section}><legend>Texture</legend><Select label={`Texture · ${item.name}`} value={values.texture} options={[{value:"none",label:"Nessuna · fondo pulito"},{value:"territory",label:"Profilo della regione · collage"},{value:"grid",label:"Reticolo cartografico"}]} onChange={value=>change({texture:value as NonNullable<ComponentStyle["texture"]>})}/>{slider("intensity","Intensità texture",0,30,1,"%")}</fieldset>
    <fieldset className={styles.section}><legend>Tipografia</legend><Select label={`Font · ${item.name}`} value={values.font} options={[{value:"manrope",label:"Manrope · identità FriulView"},{value:"system",label:"Carattere del dispositivo"},{value:"serif",label:"Georgia · serif"}]} onChange={value=>change({font:value as NonNullable<ComponentStyle["font"]>})}/><div className={styles.grid}>{slider("size","Dimensione testo",12,18,1," px")}{slider("weight","Peso del testo",400,750,50,"")}</div><p className={styles.hint}>Su touch, i campi di scrittura mantengono almeno 16 px per evitare lo zoom automatico di Safari.</p></fieldset>
    {!!textKeys.length&&<fieldset className={styles.section}><legend>Scritte del componente</legend>{textKeys.map(id=><TextSetting key={id} id={id} />)}</fieldset>}
  </>;
}
function TextSetting({id}:{id:TextId}) {
  const value=useInterfaceSettings(s=>s.config.texts[id]??UI_TEXT[id].value);
  const [pending,setPending]=useState<{base:string;value:string}|null>(null);
  const draft=pending?.base===value?pending.value:value;
  return <label className={styles.textField}><span>{UI_TEXT[id].label}</span><input type="text" maxLength={80} value={draft} onChange={e=>{if(e.target.value.trim()){setPending(null);useInterfaceSettings.getState().setText(id,e.target.value);}else setPending({base:value,value:e.target.value});}} onBlur={()=>{if(!draft.trim()){useInterfaceSettings.getState().setText(id,UI_TEXT[id].value);setPending(null);}}} /></label>;
}
export function InterfaceProject() {
  const {config,load,reset}=useInterfaceSettings(),[code,setCode]=useState(""),[message,setMessage]=useState(""),[confirm,setConfirm]=useState(false);
  return <details className={styles.project}><summary>Progetto UI · copia, importa e ripristina</summary><p>Le configurazioni sono locali al dispositivo. Il JSON contiene solo aspetto e scritte, senza osservazioni o dati degli Spazi.</p><div className={styles.actions}><button type="button" onClick={()=>{setCode(JSON.stringify(config,null,2));setMessage("Progetto generato: seleziona il testo e copialo per conservarlo.");}}>Esporta JSON</button><button type="button" onClick={()=>{try{if(code.length>100_000)throw new Error("Progetto troppo grande.");load(JSON.parse(code));setMessage("Progetto applicato.");}catch(e){setMessage(e instanceof Error?e.message:"JSON non valido.");}}}>Importa JSON</button></div><label className={styles.textField}>Progetto UI<textarea aria-label="Progetto UI JSON" value={code} onChange={e=>setCode(e.target.value)} spellCheck={false}/></label><p role="status">{message}</p><button type="button" onClick={()=>setConfirm(!confirm)}>Ripristina componenti e scritte</button>{confirm&&<div className={styles.actions}><span>Le personalizzazioni verranno rimosse.</span><button type="button" onClick={()=>{reset();setConfirm(false);setMessage("Componenti e scritte ripristinati. Tema e palette conservati.");}}>Conferma ripristino UI</button></div>}</details>;
}
