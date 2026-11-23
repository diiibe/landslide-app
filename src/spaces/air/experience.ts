import type { Experience } from "../types";
export const AIR_EXPERIENCE: Experience = {
  id: "air",
  title: "Aria e industria",
  subtitle: "Pordenonese · osservazioni e pressioni",
  description:
    "Confronta emissioni comunali, centraline e misure al camino. Esplora attività AIA, suolo e destinazioni dei piani con fonti e tempi distinti.",
  icon: "air",
  tone: "#b59a70",
  center: [12.65, 46.13],
  zoom: 9.2,
  reference: {
    name: "ARPA FVG · Regione FVG · ESA WorldCover",
    url: "https://www.arpa.fvg.it/temi/temi/aria/",
    note: "Dati reali aggiornati alla cadenza della fonte. Stime annuali, statistiche giornaliere e contesto storico restano distinti; nessuna attribuzione causale.",
  },
  zones: [],
  sensors: [],
  routes: [],
  scenarios: [],
  questions: [
    "Che aria misurano le centraline?",
    "Dove e quanto si emette?",
    "Che territorio c’è intorno?",
  ],
};
