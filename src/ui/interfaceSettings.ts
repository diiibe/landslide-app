import { create } from "zustand";
import territory from "@/assets/materials/territory-chrome-light.svg?raw";
export const COMPONENTS = [
  { id: "navbar", name: "Navbar", note: "Marchio, orologio e superficie superiore" },
  { id: "catalogButton", name: "Pulsante Catalogo", note: "Accesso al catalogo · superficie indipendente" },
  { id: "spacesButton", name: "Pulsante Spazi", note: "Accesso agli Spazi · superficie indipendente" },
  { id: "search", name: "Ricerca", note: "Campo degli indirizzi e suggerimenti" },
  { id: "drawer", name: "Pannello laterale", note: "Sfondo, tipografia e gerarchia dei livelli" },
  { id: "catalog", name: "Catalogo dei dati", note: "Finestra di esplorazione e filtri" },
  { id: "tools", name: "Comandi mappa", note: "Sfondo, Livelli, Strumenti ed Estensioni" },
  { id: "sensor", name: "Schede sensore", note: "Letture sulla mappa, dettagli rapidi e hover" },
] as const;
export type ComponentId = (typeof COMPONENTS)[number]["id"];
export const FONTS = { manrope: "'Manrope', sans-serif", system: "system-ui, sans-serif", serif: "Georgia, serif" } as const;
export type ComponentStyle = {
  background?: string; text?: string; border?: string;
  opacity?: number; shade?: number; texture?: "territory" | "grid" | "none"; intensity?: number;
  font?: keyof typeof FONTS; size?: number; weight?: number; radius?: number; depth?: number;
};
export const UI_TEXT = {
  brand: { label: "Marchio", component: "navbar", value: "FriulView" },
  catalog: { label: "Pulsante Catalogo", component: "catalogButton", value: "Catalogo" },
  spaces: { label: "Pulsante Spazi", component: "spacesButton", value: "Spazi" },
  search: { label: "Invito alla ricerca", component: "search", value: "Cerca località, via o civico…" },
  quick: { label: "Titolo scelte rapide", component: "drawer", value: "Scelte rapide" },
  explore: { label: "Titolo esplorazione", component: "drawer", value: "Esplora i dati" },
  catalogTitle: { label: "Titolo del catalogo", component: "catalog", value: "Catalogo dei dati" },
  layers: { label: "Pulsante Livelli", component: "tools", value: "Livelli" },
  tools: { label: "Pulsante Strumenti", component: "tools", value: "Strumenti" },
  extensions: { label: "Pulsante Estensioni", component: "tools", value: "Estensioni" },
  readings: { label: "Titolo letture multiple", component: "sensor", value: "Letture nello stesso punto" },
} as const;
export type TextId = keyof typeof UI_TEXT;
export interface InterfaceConfig { version: 1; components: Partial<Record<ComponentId, ComponentStyle>>; texts: Partial<Record<TextId, string>>; }
const KEY = "friulview:interface:v1";
const blank = (): InterfaceConfig => ({ version: 1, components: {}, texts: {} });
const bounds = { opacity: [70, 100], shade: [0, 30], intensity: [0, 30], size: [12, 18], weight: [400, 750], radius: [0, 16], depth: [0, 3] } as const;
const hex = /^#[0-9a-f]{6}$/i;
/** Canonical import boundary: only known enums, numbers, colours and plain text. */
export function validateInterface(value: unknown): InterfaceConfig {
  if (!value || typeof value !== "object") throw new Error("Progetto non valido.");
  const source = value as Record<string, unknown>;
  if (source.version !== 1 || !source.components || typeof source.components !== "object" || Array.isArray(source.components) || !source.texts || typeof source.texts !== "object" || Array.isArray(source.texts)) throw new Error("Usa un progetto FriulView UI versione 1.");
  const config = blank();
  for (const component of COMPONENTS) {
    const style = (source.components as Record<string, unknown>)[component.id];
    if (style === undefined) continue;
    if (!style || typeof style !== "object" || Array.isArray(style)) throw new Error("Componente non valido.");
    const result: Record<string, string | number> = {};
    for (const [key, item] of Object.entries(style)) {
      if (["background", "text", "border"].includes(key)) { if (typeof item !== "string" || !hex.test(item)) throw new Error("Colore non valido."); result[key] = item; }
      else if (Object.hasOwn(bounds,key)) { const [min, max] = bounds[key as keyof typeof bounds]; if (typeof item !== "number" || !Number.isFinite(item) || item < min || item > max) throw new Error("Regolazione fuori intervallo."); result[key] = item; }
      else if (key === "font") { if (typeof item !== "string" || !Object.hasOwn(FONTS,item)) throw new Error("Font non valido."); result[key] = item; }
      else if (key === "texture") { if (!["none", "territory", "grid"].includes(String(item))) throw new Error("Texture non valida."); result[key] = String(item); }
    }
    config.components[component.id] = result as ComponentStyle;
  }
  for (const id of Object.keys(UI_TEXT) as TextId[]) {
    const text = (source.texts as Record<string, unknown>)[id];
    if (text !== undefined) { if (typeof text !== "string" || !text.trim() || text.length > 80) throw new Error("Scritta non valida: usa da 1 a 80 caratteri."); config.texts[id] = text; }
  }
  return config;
}
export function readInterface(): InterfaceConfig {
  try { const value = localStorage.getItem(KEY); return value ? validateInterface(JSON.parse(value)) : blank(); } catch { return blank(); }
}
export function contrastText(color: string) {
  const channels = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16) / 255).map((c) => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
  const luminance = channels[0]! * .2126 + channels[1]! * .7152 + channels[2]! * .0722;
  return luminance > .179 ? "#17251b" : "#f4f7ef";
}
function texture(style: ComponentStyle, dark: boolean) {
  const ink = style.text ?? (style.background ? contrastText(style.background) : dark ? "#edf3e9" : "#202b24");
  const alpha = (style.intensity ?? 10) / 100;
  if (style.texture === "none") return "none";
  if (style.texture === "grid") return `linear-gradient(${ink}${Math.round(alpha * 255).toString(16).padStart(2,"0")} 1px,transparent 1px),linear-gradient(90deg,${ink}${Math.round(alpha * 255).toString(16).padStart(2,"0")} 1px,transparent 1px)`;
  const svg = territory.replace('opacity="0.115"', `opacity="${alpha}"`).replace('stroke="#202b24"', `stroke="${ink}"`);
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
export function interfaceCSS(config: InterfaceConfig) {
  const tokens=["surface","surface-raised","surface-2","surface-sunken","text","text-muted","text-soft","border","border-strong","selected"];
  let css=":root{--ui-base-text-body:var(--text-body);--ui-base-text-caption:var(--text-caption);--ui-base-material-chrome:var(--material-chrome);--ui-base-material-panel:var(--material-panel);"+tokens.map(t=>`--ui-base-${t}:var(--c-${t})`).join(";")+"}";
  css+=':where([data-ui]){font-family:var(--font-stack);font-size:var(--ui-base-text-body);font-weight:400;}[data-ui]{--text-body:var(--ui-base-text-body);--text-caption:var(--ui-base-text-caption);--font-stack:"Manrope",sans-serif;--material-chrome:var(--ui-base-material-chrome);--material-panel:var(--ui-base-material-panel);'+tokens.map(t=>`--c-${t}:var(--ui-base-${t})`).join(";")+"}";
  for (const item of COMPONENTS) {
    const s = config.components[item.id]; if (!s) continue;
    const selector = `[data-ui="${item.id}"]`, rules: string[] = [];
    if (s.background) {
      const rgb = [1,3,5].map(i=>parseInt(s.background!.slice(i,i+2),16)).join(" ");
      const foreground=s.text??contrastText(s.background);
      rules.push(`--c-surface:${s.background}`,`--c-surface-raised:color-mix(in srgb,${s.background} 95%,${foreground})`,`--c-surface-2:color-mix(in srgb,${s.background} 90%,${foreground})`,`--c-surface-sunken:color-mix(in srgb,${s.background} 90%,#101b13)`,`--c-text:${foreground}`,`--c-text-muted:color-mix(in srgb,${foreground} 85%,${s.background})`,`--c-text-soft:var(--c-text-muted)`,`--c-border:${s.border??`color-mix(in srgb,${foreground} 25%,${s.background})`}`,`--c-border-strong:${s.border??`color-mix(in srgb,${foreground} 40%,${s.background})`}`,`--c-selected:color-mix(in srgb,${foreground} 12%,${s.background})`,`--material-chrome:var(--c-surface-raised)`,`--material-panel:var(--c-surface-2)`);
      rules.push(`background-color:rgb(${rgb} / ${(s.opacity ?? 100)/100})!important`, `color:${s.text ?? contrastText(s.background)}!important`);
    } else if (s.opacity !== undefined) rules.push(`background-color:color-mix(in srgb,var(--c-surface) ${s.opacity}%,transparent)!important`);
    if (s.text) rules.push(`color:${s.text}!important`);
    if (s.border) rules.push(`border-color:${s.border}!important`);
    if (s.radius !== undefined) rules.push(`border-radius:${s.radius}px!important`);
    if (s.depth !== undefined) rules.push(`box-shadow:${s.depth ? `inset 0 1px rgb(255 255 255 / .12),0 ${s.depth}px ${s.depth*3}px rgb(10 23 14 / ${.09+s.depth*.04})` : "none"}!important`);
    if (s.font) rules.push(`--font-stack:${FONTS[s.font]}`,`font-family:${FONTS[s.font]}!important`);
    if (s.size !== undefined) rules.push(`font-size:${s.size}px!important`,`--text-body:${s.size}px`,`--text-caption:${Math.max(11,s.size-2)}px`);
    if (s.weight !== undefined) rules.push(`font-weight:${s.weight}!important`);
    const surfaces=item.id==="tools" ? `${selector},${selector} :is(button,summary):not(dialog *,[role="dialog"] *)` : selector;
    css += `${surfaces}{${rules.join(";")}}`;
    const children = `${selector} :is(button,input,textarea,label,p,small,strong,summary,span,h1,h2,h3):where(:not(${selector} [data-ui],${selector} [data-ui] *))`;
    const fontRules = [s.font ? `font-family:${FONTS[s.font]}!important` : "",s.size !== undefined ? `font-size:${s.size}px!important` : "",s.weight !== undefined ? `font-weight:${s.weight}!important` : ""].filter(Boolean).join(";");
    if (fontRules) css += `${children}{${fontRules}}`;
    if (s.text || s.background) css += `${children}{color:${s.text ?? contrastText(s.background!)}!important}`;
    if (item.id==="navbar") {
      if(s.size!==undefined)css+=`${selector} [data-ui-part="brand-label"]{font-size:${s.size+4}px!important}${selector} [data-ui-part="clock"],${selector} [data-ui-part="clock"] span{font-size:${Math.max(10,s.size-3)}px!important}`;
      if(s.weight!==undefined)css+=`${selector} [data-ui-part="brand"],${selector} [data-ui-part="clock"]{font-weight:${s.weight}!important}`;
    }
    if (s.size !== undefined) css += `@media(pointer:coarse){${selector} :is(input,textarea):not(${selector} [data-ui],${selector} [data-ui] *){font-size:${Math.max(16,s.size)}px!important}}`;
    if (s.texture !== undefined || s.intensity !== undefined || s.shade !== undefined) {
      for (const dark of [false,true]) {
        const pattern = texture({...s,texture:s.texture ?? (["navbar","drawer","catalog"].includes(item.id)?"territory":"none")},dark);
        const shade = `linear-gradient(120deg,rgb(255 255 255 / ${(s.shade ?? 0)/100}),transparent 70%)`;
        css += `${dark ? ':root[data-theme="dark"] ' : ""}${selector}{background-image:${shade},${pattern}!important;background-size:auto,${s.texture==="grid"?"18px 18px,18px 18px":"720px 210px"}!important;background-position:center!important}`;
      }
    }
  }
  return css + '@media(forced-colors:active),(prefers-contrast:more){:root[data-theme] [data-ui]{background-image:none!important}}';
}
function apply(config: InterfaceConfig) {
  if (typeof document === "undefined") return;
  let node = document.getElementById("friulview-interface-overrides");
  if (!node) { node = document.createElement("style"); node.id = "friulview-interface-overrides"; document.head.append(node); }
  node.textContent = interfaceCSS(config);
}
function persist(config: InterfaceConfig) { apply(config); try { localStorage.setItem(KEY,JSON.stringify(config)); return true; } catch { return false; /* Session editing remains available. */ } }
const initial = readInterface(); apply(initial);
export const useInterfaceSettings = create<{ config: InterfaceConfig; persistent:boolean; setStyle:(id:ComponentId, patch:Partial<ComponentStyle>)=>void; setText:(id:TextId,text:string)=>void; reset:(id?:ComponentId)=>void; load:(value:unknown)=>void }>((set,get)=>({
  config:initial,persistent:true,
  setStyle:(id,patch)=>{ const next=validateInterface({...get().config,components:{...get().config.components,[id]:{...get().config.components[id],...patch}}});const persistent=persist(next);set({config:next,persistent}); },
  setText:(id,text)=>{ if(!text.trim()) return; const next=validateInterface({...get().config,texts:{...get().config.texts,[id]:text}});const persistent=persist(next);set({config:next,persistent}); },
  reset:(id)=>{ const next=structuredClone(get().config); if(!id){const persistent=persist(blank());set({config:blank(),persistent});return;} delete next.components[id];for(const key of Object.keys(next.texts) as TextId[])if(UI_TEXT[key].component===id)delete next.texts[key];const persistent=persist(next);set({config:next,persistent}); },
  load:(value)=>{ const next=validateInterface(value);const persistent=persist(next);set({config:next,persistent}); },
}));
export function useUIText(id: TextId) { return useInterfaceSettings(s=>s.config.texts[id] ?? UI_TEXT[id].value); }
