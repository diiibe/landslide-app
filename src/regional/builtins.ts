import { VARIABLES, VARIABLE_GROUPS, type Variable } from "@/digital-twin/data";
import { useTwinStore } from "@/digital-twin/store";
import { setRegionalEnabled, useRegionalStore } from "./store";
import type { LayerDefinition, FolderId } from "./types";
export const PCR_VARIABLES = Object.keys(VARIABLES) as Variable[];
const base = {
  status: "ready" as const,
  provider: "Protezione Civile della Regione Friuli Venezia Giulia",
  license: "CC BY 4.0",
  licenseUrl: "https://www.protezionecivile.fvg.it/note-legali",
  sourceId: "PCR",
  sourceUrl: "https://monitor.protezionecivile.fvg.it/",
  cadence: "Verifica automatica ogni 60 secondi",
};
export const BUILTIN_LAYERS: LayerDefinition[] = [
  ...PCR_VARIABLES.map((variable) => {
    const v = VARIABLES[variable];
    const folder: FolderId = [
      "sea",
      "current",
      "currentUpper",
      "currentLower",
      "estuaryFlow",
    ].includes(variable)
      ? "mare"
      : v.group === "water"
        ? "acqua"
        : v.group === "land"
          ? "verde"
          : "meteo";
    return {
      ...base,
      id: "pcr-" + variable,
      title: v.label,
      folder,
      kind: "pcr" as const,
      pcrVariable: variable,
      description: v.description,
      note: "Misure puntuali; non interpolazioni del territorio. Colore e dimensione non sono soglie di pericolo.",
      color: v.colors[1],
      subfolder: VARIABLE_GROUPS[v.group],
      metric: {
        field: "value",
        unit: v.unit,
        ...(v.comparable ? { min: v.min, max: v.max } : {}),
      },
    };
  }),
  {
    ...base,
    id: "pcr-radar",
    title: "Radar precipitazioni · SRI",
    folder: "meteo",
    kind: "radar",
    description: "Intensità della precipitazione dal radar regionale.",
    note: "Il prodotto riporta la propria ora di osservazione. Le zone senza eco non equivalgono a dati mancanti.",
    color: "#77a36e",
  },
  {
    id: "twin-buildings",
    title: "Edifici · Trieste e Monfalcone",
    folder: "contesto",
    kind: "buildings",
    status: "ready",
    provider: "Regione FVG / IRDAT",
    sourceId: "DBTfvg",
    sourceUrl:
      "https://www.regione.fvg.it/rafvg/cms/RAFVG/ambiente-territorio/conoscere-ambiente-territorio/FOGLIA4/",
    license: "IODL 2.0",
    licenseUrl:
      "https://www.regione.fvg.it/rafvg/cms/RAFVG/ambiente-territorio/conoscere-ambiente-territorio/FOGLIA4/",
    description:
      "Edificato urbano estratto dal rilievo regionale 2017–2020, con altezze dove disponibili.",
    note: "8.152 edifici: i 1.284 senza quota attendibile restano piatti. Non è un BIM aggiornato in tempo reale.",
    cadence: "Campagna 2017–2020 · sincronizzazione programmata",
    color: "#a3b8b4",
    count: 8152,
    bounds: [
      [13.48, 45.58],
      [13.84, 45.85],
    ],
  },
];
export function isPCREnabled(variable: Variable): boolean {
  return (
    useRegionalStore.getState().enabled["pcr-" + variable] ??
    variable === "wind"
  );
}
export function isLayerEnabled(layer: LayerDefinition): boolean {
  return (
    useRegionalStore.getState().enabled[layer.id] ?? layer.id === "pcr-wind"
  );
}
export function enableLayer(layer: LayerDefinition, on: boolean) {
  setRegionalEnabled(layer.id, on);
  if (layer.kind === "radar") useTwinStore.setState({ radarOn: on });
  if (layer.kind === "buildings") useTwinStore.setState({ buildingsOn: on });
  if (layer.kind === "aia") useTwinStore.setState({ assetsOn: on });
}
