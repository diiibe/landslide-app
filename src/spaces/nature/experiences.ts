import type { Experience, NatureId } from "../types";
const bounds = (
  w: number,
  s: number,
  e: number,
  n: number,
): GeoJSON.Polygon => ({
  type: "Polygon",
  coordinates: [
    [
      [w, s],
      [e, s],
      [e, n],
      [w, n],
      [w, s],
    ],
  ],
});
export const natureLabel = (id: string | null) =>
  id === "fire"
    ? "Archivio documentato · agosto 2026"
    : id === "park"
      ? "Censimento reale · gestione simulata"
      : id === "wildlife"
        ? "Fototrappole · visione simulata"
        : "";
export const NATURE_EXPERIENCES: Experience[] = [
  {
    id: "fire",
    title: "Amariana · dopo il fuoco",
    subtitle: "Tolmezzo e Amaro · agosto 2026",
    description:
      "Ripercorri l’incendio attraverso comunicati e misure pubbliche. Confronta le giornate, esplora i luoghi e consulta le fonti.",
    icon: "fire",
    tone: "#da7145",
    center: [13.06, 46.415],
    zoom: 11.3,
    reference: {
      name: "Regione FVG · Comune di Tolmezzo · ARPA FVG",
      url: "https://www.comune.tolmezzo.ud.it/novita/incendio-sul-monte-amariana-tutti-gli-aggiornamenti/",
      note: "Ricostruzione storica. Non è un servizio di allerta o una mappa di incendi attivi.",
    },
    zones: [],
    sensors: [],
    routes: [],
    scenarios: [],
    questions: [
      "Come è cambiata la situazione?",
      "Quali misure sono confrontabili?",
      "Che cosa sappiamo del perimetro?",
    ],
  },
  {
    id: "wildlife",
    title: "Tracce nel bosco",
    subtitle: "Carnia · laboratorio di fototrappolaggio",
    description:
      "Esplora catture sintetiche, proposte del classificatore e revisione umana. Confronta specie, ore di attività e sforzo di campionamento.",
    icon: "camera",
    tone: "#bd9c62",
    center: [13.177, 46.471],
    zoom: 13.6,
    perimeter: bounds(13.165, 46.463, 13.189, 46.48),
    reference: {
      name: "Rete dimostrativa indipendente",
      url: "https://lila.science/datasets",
      note: "Camere, immagini generate e classificazioni simulate. Nessun modello vision eseguito, nessuna posizione di animali reali.",
    },
    zones: [],
    sensors: [],
    routes: [],
    scenarios: [],
    questions: [
      "Quali catture meritano una revisione?",
      "Quanta parte della rete ha campionato?",
      "Quando compaiono le specie?",
    ],
  },
  {
    id: "park",
    title: "Villa Manin · patrimonio vivo",
    subtitle: "Passariano · censimento e cura del parco",
    description:
      "Esplora gli alberi geolocalizzati dell’archivio ERPAC e costruisci un giro di sopralluogo dimostrativo, separato dallo stato storico.",
    icon: "tree",
    tone: "#71a77f",
    center: [13.011, 45.951],
    zoom: 16.1,
    reference: {
      name: "ERPAC · Open Data FVG · uqpq-dr8x",
      url: "https://www.dati.friuliveneziagiulia.it/Ambiente/Alberi-di-Villa-Manin/uqpq-dr8x",
      note: "Rilievi 2001–2002; coordinate presenti solo per una parte del censimento. Non indicano alberi ancora presenti o sicuri oggi.",
    },
    zones: [],
    sensors: [],
    routes: [],
    scenarios: [],
    questions: [
      "Quali specie sono rappresentate?",
      "Quanto è completo il censimento?",
      "Come organizzare un sopralluogo?",
    ],
  },
];
export const natureSummary: Record<NatureId, string> = {
  fire: "Cronologia · luoghi · fonti",
  wildlife: "8 camere virtuali · revisione AI",
  park: "Alberi reali · sopralluoghi demo",
};
