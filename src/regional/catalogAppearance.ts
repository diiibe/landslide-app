import type { IconName } from "@/ui/Icon";
import type { ThemeId } from "./catalog";

// Category colours are wayfinding cues. They never replace measurement scales.
export const CATEGORY: Record<ThemeId, { icon: IconName; tone: string; note: string }> = {
  frane: { icon: "mountain", tone: "terrain", note: "Suscettibilità e inventari" },
  alluvioni: { icon: "water", tone: "water", note: "Mappe e fasce di pericolosità" },
  meteo: { icon: "weather", tone: "water", note: "Stazioni e precipitazioni" },
  mare: { icon: "waves", tone: "water", note: "Boe, onde e costa" },
  aria: { icon: "air", tone: "nature", note: "Misure e campionamenti" },
  energia: { icon: "energy", tone: "terrain", note: "Impianti e reti" },
  trasformazioni: { icon: "territory", tone: "terrain", note: "Uso e trasformazioni del suolo" },
  attivita: { icon: "factory", tone: "built", note: "Imprese, turismo e porto" },
  ambiente: { icon: "recycle", tone: "nature", note: "Rifiuti e monitoraggi" },
  acqua: { icon: "water", tone: "water", note: "Risorsa idrica e analisi" },
  verde: { icon: "leaf", tone: "nature", note: "Habitat, parchi e suoli" },
  servizi: { icon: "services", tone: "built", note: "Luoghi e servizi pubblici" },
  mobilita: { icon: "mobility", tone: "built", note: "Strade, sentieri e ciclovie" },
  infrastrutture: { icon: "network", tone: "built", note: "Reti e telecomunicazioni" },
  contesto: { icon: "layers", tone: "neutral", note: "Immagini, rilievi ed edifici" },
  personali: { icon: "folder", tone: "neutral", note: "File caricati da te" },
};
