import type { Experience } from "../types";
export const TREK_EXPERIENCE: Experience = {
  id: "trek",
  title: "SmartTrek · sentieri connessi",
  subtitle: "Dolomiti Friulane · Val Meluzzo",
  description:
    "Una rete virtuale di segnavia sul corridoio Pordenone–Valbinon: esplora passaggi BLE, alimentazione e consegna dei messaggi.",
  icon: "trailMarker",
  tone: "#86b79b",
  center: [12.515, 46.393],
  zoom: 11.8,
  reference: {
    name: "SmartTrek · firmware cariddi-stefano",
    url: "https://github.com/cariddi-stefano/firmware-smart-trek",
    note: "Demo indipendente. Telemetria sintetica; nessun nodo, Master o servizio cloud collegato.",
  },
  zones: [],
  sensors: [],
  routes: [],
  scenarios: [],
  questions: [
    "Quali segnavia richiedono un controllo?",
    "Quali dati sono ancora in attesa?",
    "Dove vengono rilevati più dispositivi?",
  ],
};
