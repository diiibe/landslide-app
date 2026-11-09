import { VARIABLES } from "@/digital-twin/data";
import type { LayerDefinition } from "./types";

export type DisplayMode = "auto" | "points" | "density";
export interface Presentation {
  type: "raster" | "surface" | "network" | "registry" | "measurement" | "direction" | "earthquake" | "buildings";
  title: string;
  description: string;
  density: boolean;
  clustered: boolean;
  local: boolean;
  colors: [string, string, string];
}
const colors: Record<string, [string, string, string]> = {
  servizi: ["#f2e1ec", "#ad6094", "#64284e"],
  attivita: ["#f2e3cd", "#b58342", "#704b25"],
  infrastrutture: ["#e5e4f3", "#7978ad", "#3f3f70"],
  contesto: ["#e0eae7", "#718f86", "#344f46"],
  mobilita: ["#e5e9e3", "#7b8e72", "#3e5337"],
  aria: ["#ede2f0", "#9866a3", "#51295e"],
  acqua: ["#d9edf1", "#32839e", "#174b64"],
  mare: ["#d8eee7", "#258c91", "#164e59"],
  meteo: ["#e4ecf0", "#5785ac", "#284d75"],
  energia: ["#f6e8c8", "#bc8a2a", "#77501b"],
  trasformazioni: ["#f0e3d7", "#b57a4b", "#714329"],
  ambiente: ["#eee2d1", "#a17b4c", "#654928"],
  verde: ["#e0ecd5", "#6f964d", "#36582a"],
};
/** Resolve every distribution from its actual geometry, units and provenance.
 * Density is deliberately unavailable for environmental observations: a smooth
 * blob of sampling sites would imply a measured continuous field that we lack.
 */
export function presentation(l: LayerDefinition): Presentation {
  const signed = (l.metric?.min ?? 0) < 0 && (l.metric?.max ?? 0) > 0;
  const palette: [string, string, string] = l.pcrVariable ? [...VARIABLES[l.pcrVariable].colors] : signed ? ["#3b78a0", "#e8ece5", "#b36140"] : colors[l.folder] ?? ["#e4e8e2", l.color, "#384d40"];
  const base = { colors: palette, density: false, clustered: false, local: false };
  if (l.kind === "raster" || l.kind === "radar") return { ...base, type: "raster", title: "Immagine georeferenziata", description: "Copertura e risoluzione della fonte; nessuna interpolazione aggiunta." };
  if (l.kind === "buildings") return { ...base, type: "buildings", title: "Impronte e volumi urbani", description: l.overview ? "Da lontano i gruppi contano le impronte censite; avvicinandoti compaiono gli edifici. Volumi soltanto dove è disponibile un’altezza attendibile." : "Perimetri in pianta; volumi soltanto dove è disponibile un’altezza attendibile." };
  if (l.liveKind === "earthquakes") return { ...base, type: "earthquake", title: "Epicentri e magnitudo", description: "Cerchi dimensionati per magnitudo; ogni evento conserva la propria data. Non è una previsione." };
  const angular = /^(°N|gradi|deg|degrees?|° rispetto al nord)$/i.test(l.metric?.unit ?? "") && /direzione/i.test(l.title);
  if (angular) return { ...base, type: "direction", title: "Direzione nel punto", description: "Freccia orientata secondo l’angolo pubblicato dalla fonte, riferito al Nord. Nessun moto simulato." };
  if (/^sts$|^%ON$/i.test(l.metric?.unit ?? "") || /stato|allarme|anomalia|presenza rete/i.test(l.title) && l.liveKind === "pcr")
    return { ...base, type: "measurement", local: true, title: "Stato tecnico della stazione", description: "Codice o stato originale pubblicato dalla rete. Simboli uniformi: nessuna scala ambientale o interpretazione di allarme non documentata dalla fonte." };
  const geometry = l.geometryTypes ?? [];
  const polygon = geometry.some((g) => g.includes("Polygon"));
  const line = geometry.some((g) => g.includes("LineString"));
  if (polygon) return { ...base, type: "surface", title: l.metric ? "Valori per area" : "Perimetri e piccole aree", description: l.metric ? "Il colore rappresenta il valore attribuito all’area, non una misura uniforme in ogni suo punto. I conteggi non sono densità per km²." : l.overview ? "Da lontano, i riferimenti indicano piccole aree censite. Avvicinandoti compaiono i perimetri; il riferimento non rappresenta l’estensione." : "Riempimenti trasparenti e bordi graduati con lo zoom; le geometrie originali si leggono avvicinandosi." };
  if (line) return { ...base, type: "network", title: "Rete a più scale", description: "Tracciati con spessore progressivo e bordo di contrasto; lo zoom rivela il dettaglio della rete." };
  if (l.metric || l.kind === "pcr") {
    const local = /idrometr/i.test(l.title);
    return { ...base, type: "measurement", local, title: local ? "Livelli riferiti alla stazione" : "Misure puntuali", description: local ? "Simboli uniformi: gli zeri idrometrici sono locali e non definiscono una quota o un pericolo comune." : "Colore e valore nel punto osservato. Nessuna interpolazione tra stazioni; valori censurati o non validi restano distinti." };
  }
  const dense = (l.count ?? 0) > 200;
  return { ...base, type: "registry", density: dense, clustered: dense && l.kind === "geojson", title: dense ? "Gruppi e singoli elementi" : "Luoghi censiti", description: dense ? "Da lontano i gruppi indicano il numero di record. Tocca un gruppo per avvicinarti; i singoli elementi emergono allo zoom. La densità è relativa al censimento, non al rischio né all’attività in corso." : "Punti con bordo di contrasto, selezionabili anche da telefono; il simbolo indica un luogo, non un’attività in tempo reale." };
}
