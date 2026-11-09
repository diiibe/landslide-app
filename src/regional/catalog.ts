import { useAppStore, type AppState } from "@/app/store";
import { BUILTIN_LAYERS } from "./builtins";
import { FOLDERS, type LayerDefinition } from "./types";

export const THEMES = {
  frane: "Frane e versanti",
  alluvioni: "Alluvioni",
  ...FOLDERS,
  personali: "I miei dati",
};
export type ThemeId = keyof typeof THEMES;
type LegacyKey = keyof AppState["layers"];
export const MAP_LAYERS: {
  key: LegacyKey;
  title: string;
  theme: ThemeId;
  description: string;
}[] = [
  {
    key: "v2Bodies",
    title: "Corpi di frana · Suscettibilità",
    theme: "frane",
    description:
      "Mappatura della suscettibilità dei versanti ai corpi di frana. Classi relative, non probabilità di un evento.",
  },
  {
    key: "v2Diffuse",
    title: "Zone diffuse · Suscettibilità",
    theme: "frane",
    description:
      "Mappatura della suscettibilità a crolli e frane superficiali diffuse. Classi relative, non probabilità di un evento.",
  },
  {
    key: "iffi",
    title: "Frane censite · IFFI",
    theme: "frane",
    description:
      "Inventario delle frane censite: confronto con le mappature di suscettibilità.",
  },
  {
    key: "flood",
    title: "Suscettibilità alle alluvioni",
    theme: "alluvioni",
    description: "Mappatura territoriale della suscettibilità alle alluvioni.",
  },
  {
    key: "pai",
    title: "Fasce di pericolosità · PAI",
    theme: "alluvioni",
    description:
      "Fasce di pericolosità idraulica della pianificazione di bacino.",
  },
  {
    key: "diff",
    title: "Confronto alluvioni e PAI",
    theme: "alluvioni",
    description: "Concordanze e differenze tra la mappatura e le fasce PAI.",
  },
  {
    key: "floodHistorical",
    title: "Alluvioni storiche · Copernicus",
    theme: "alluvioni",
    description:
      "Osservazioni satellitari degli eventi Friuli 2017 e Vaia 2018.",
  },
  {
    key: "dtm",
    title: "Rilievo del terreno · DTM",
    theme: "contesto",
    description: "Ombreggiatura del rilievo regionale.",
  },
  {
    key: "roads",
    title: "Strade",
    theme: "mobilita",
    description: "Rete stradale OpenStreetMap.",
  },
  {
    key: "trails",
    title: "Sentieri",
    theme: "mobilita",
    description: "Rete dei sentieri OpenStreetMap.",
  },
  {
    key: "poiCritical",
    title: "Strutture essenziali",
    theme: "servizi",
    description: "Scuole, ospedali e presidi di emergenza da OpenStreetMap.",
  },
  {
    key: "poiHuts",
    title: "Rifugi e bivacchi",
    theme: "servizi",
    description: "Rifugi e bivacchi da OpenStreetMap.",
  },
];
/** Only replace machine codes when the recorded source URL identifies the portal. */
export function displayProvider(layer: LayerDefinition): string {
  if (/^[a-z0-9]{4}-[a-z0-9]{4}$/.test(layer.provider)) {
    try {
      if (
        new URL(layer.sourceUrl).hostname === "www.dati.friuliveneziagiulia.it"
      )
        return "Open Data FVG";
    } catch {
      /* Keep the original attribution if its origin is unknown. */
    }
  }
  return layer.provider;
}
export interface CatalogItem {
  layer: LayerDefinition;
  theme: ThemeId;
  mapKey?: LegacyKey;
  userId?: string;
}
export function catalogItems(layers: LayerDefinition[]): CatalogItem[] {
  const regional = [
    ...BUILTIN_LAYERS.filter((b) => !layers.some((l) => l.id === b.id)),
    ...layers,
  ];
  return [
    ...MAP_LAYERS.map((m) => ({
      theme: m.theme,
      mapKey: m.key,
      layer: {
        id: "map-" + m.key,
        title: m.title,
        folder: "contesto" as const,
        description: m.description,
        note: "",
        status: "ready" as const,
        sourceId: m.key.startsWith("v2")
          ? "Modello territoriale"
          : m.key === "iffi"
            ? "IFFI"
            : m.theme === "alluvioni"
              ? "Cartografia alluvioni"
              : m.key === "dtm"
                ? "DTM FVG"
                : "OpenStreetMap",
        sourceUrl: "",
        provider: m.key.startsWith("v2")
          ? "Mappature della piattaforma"
          : m.key === "iffi"
            ? "ISPRA"
            : m.theme === "alluvioni"
              ? "Pianificazione e osservazioni territoriali"
              : m.key === "dtm"
                ? "Regione FVG"
                : "OpenStreetMap",
        license: "Vedi documentazione della fonte",
        licenseUrl: "",
        cadence: m.key.startsWith("v2")
          ? "Edizione del modello"
          : m.key === "roads" || m.key === "trails"
            ? "Sincronizzazione giornaliera"
            : "Edizione della cartografia",
        color: m.theme === "frane" ? "#b44a29" : "#537762",
      },
    })),
    ...regional.map((layer) => ({ layer, theme: layer.folder })),
    ...useAppStore.getState().userLayers.map((u) => ({
      userId: u.id,
      theme: "personali" as const,
      layer: {
        id: "user-" + u.id,
        title: u.name,
        folder: "contesto" as const,
        description: "File aggiunto alla mappa.",
        note: "",
        status: "ready" as const,
        sourceId: "File personale",
        sourceUrl: "",
        provider: "I miei dati",
        license: "Dati personali",
        licenseUrl: "",
        cadence: "Caricamento manuale",
        color: u.color,
        ...(u.bounds ? { bounds: u.bounds } : {}),
      },
    })),
  ];
}
export const normalize = (s: string) =>
  s
    .toLocaleLowerCase("it")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
export function itemType(item: CatalogItem) {
  if (item.userId) return "File personale";
  if (item.mapKey)
    return item.mapKey.startsWith("v2") ||
      ["flood", "pai", "diff"].includes(item.mapKey)
      ? "Mappatura"
      : "Cartografia";
  const l = item.layer;
  return l.kind === "pcr" || l.liveKind === "pcr" || l.live
    ? "Sensore"
    : l.kind === "radar"
      ? "Radar"
      : l.kind === "raster"
        ? "Immagine"
        : l.metric
          ? "Misura ambientale"
          : "Cartografia";
}
export function itemCadence(item: CatalogItem) {
  const l = item.layer;
  return l.live ||
    l.pollUrl ||
    l.liveKind === "pcr" ||
    l.kind === "pcr" ||
    l.kind === "radar"
    ? "Monitoraggio continuo"
    : item.mapKey === "roads" || item.mapKey === "trails"
      ? "Giornaliero"
      : "Periodico / edizione";
}
export interface CatalogFilters {
  query: string;
  theme: string;
  provider: string;
  type: string;
  cadence: string;
  availability: string;
}
export function filterItems(
  items: CatalogItem[],
  f: CatalogFilters,
  enabled: (l: LayerDefinition) => boolean,
) {
  const words = normalize(f.query).trim().split(/\s+/).filter(Boolean);
  return items.filter((i) => {
    const l = i.layer;
    const text = normalize(
      [
        l.title,
        l.description,
        l.sourceId,
        l.provider,
        displayProvider(l),
        l.subfolder,
        THEMES[i.theme],
        l.metric?.unit,
      ].join(" "),
    );
    return (
      words.every((w) => text.includes(w)) &&
      (!f.theme || f.theme === i.theme) &&
      (!f.provider || f.provider === displayProvider(l)) &&
      (!f.type || f.type === itemType(i)) &&
      (!f.cadence || f.cadence === itemCadence(i)) &&
      (!f.availability ||
        (f.availability === "ready"
          ? l.status === "ready"
          : f.availability === "active"
            ? enabled(l)
            : l.status === "blocked"))
    );
  });
}
