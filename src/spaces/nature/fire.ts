export const FIRE_SOURCES = {
  commune:
    "https://www.comune.tolmezzo.ud.it/novita/incendio-sul-monte-amariana-tutti-gli-aggiornamenti/",
  trails:
    "https://www.comune.tolmezzo.ud.it/novita/incendio-sui-monti-amariana-pale-viarte-e-dobis-chiusa-per-60-giorni-la-rete-escursionistica-nelle-aree-interessate/",
  region:
    "https://www.regione.fvg.it/rafvg/comunicati/comunicato.act?dir=%2Frafvg%2Fcms%2FRAFVG%2Fnotiziedallagiunta%2F&nm=20260814172539001",
  arpa: "https://www.arpa.fvg.it/temi/temi/aria/news/incendio-sul-monte-amariana-alpi-tolmezzine-orientali-carnia/",
  effis: "https://forest-fire.emergency.copernicus.eu/about-effis/data-license",
};
export const FIRE_EVENTS = [
  {
    date: "2026-08-14",
    title: "Emergenza e mezzi in campo",
    text: "La Regione comunica una stima di circa 450 ha interessati e l’impiego di tre aerei e cinque elicotteri sull’Amariana. Stima comunicata in quella data, non superficie definitiva.",
    source: FIRE_SOURCES.region,
    center: [13.065, 46.407] as [number, number],
  },
  {
    date: "2026-08-17",
    title: "Riapre la strada per Illegio",
    text: "Il Comune revoca la chiusura della strada per Illegio. Restano allora in vigore evacuazione di Pissebus e sospensione della circolazione sulla SR UD 125.",
    source: FIRE_SOURCES.commune,
    center: [13.04, 46.431] as [number, number],
  },
  {
    date: "2026-08-18",
    title: "Rientro a Pissebus",
    text: "Revocata l’ordinanza di evacuazione dopo il sopralluogo dei Vigili del Fuoco. Il comunicato conserva l’invito alla vigilanza e la chiusura della SR UD 125.",
    source: FIRE_SOURCES.commune,
    center: [13.039, 46.396] as [number, number],
  },
  {
    date: "2026-08-19",
    title: "Il monitoraggio dell’aria migliora",
    text: "ARPA descrive concentrazioni di PM10 confrontabili con il resto della regione. Le misure speditive restano istantanee: non sono medie giornaliere della rete fissa.",
    source: FIRE_SOURCES.arpa,
    center: [13.015, 46.406] as [number, number],
  },
  {
    date: "2026-08-20",
    title: "Tutela della rete escursionistica",
    text: "L’ordinanza n. 18 interdice per 60 giorni la rete nelle aree attraversate dai fuochi. È un provvedimento storico: questa scheda non attesta l’accessibilità odierna.",
    source: FIRE_SOURCES.trails,
    center: [13.065, 46.42] as [number, number],
  },
  {
    date: "2026-08-26",
    title: "Indicati i percorsi compromessi",
    text: "L’ordinanza n. 19 specifica CAI 412, CAI 462 e sentiero alpinistico Mario dalla Marta. Qui non ricostruiamo tracciati di chiusura da semplici nomi.",
    source: FIRE_SOURCES.trails,
    center: [13.052, 46.414] as [number, number],
  },
];
export const AIR_SITES = [
  {
    id: "amaro",
    name: "Amaro · casa dell’acqua",
    coordinates: [13.094, 46.375] as [number, number],
  },
  {
    id: "pissebus",
    name: "Pissebus · interruzione della circolazione",
    coordinates: [13.039, 46.396] as [number, number],
  },
  {
    id: "tolmezzo",
    name: "Tolmezzo · via Divisione Osoppo",
    coordinates: [13.015, 46.408] as [number, number],
  },
];
export type AirObservation = {
  site: string;
  date: string;
  time: string;
  low: number;
  high: number;
};
// Numerical facts transcribed from the dated ARPA tables. Ranges are preserved,
// no averages or inferred intermediate values; coordinates are locality anchors.
export const AIR_OBSERVATIONS: AirObservation[] = [
  { site: "amaro", date: "2026-08-14", time: "13:34", low: 34, high: 34 },
  { site: "tolmezzo", date: "2026-08-14", time: "13:53", low: 44, high: 44 },
  { site: "amaro", date: "2026-08-15", time: "08:15", low: 274, high: 274 },
  { site: "amaro", date: "2026-08-15", time: "11:25", low: 42.5, high: 42.5 },
  { site: "tolmezzo", date: "2026-08-15", time: "08:44", low: 80, high: 90 },
  { site: "tolmezzo", date: "2026-08-15", time: "11:12", low: 75, high: 82 },
  { site: "amaro", date: "2026-08-16", time: "07:24", low: 199, high: 199 },
  { site: "pissebus", date: "2026-08-16", time: "07:39", low: 416, high: 442 },
  { site: "tolmezzo", date: "2026-08-16", time: "08:05", low: 82, high: 88 },
  { site: "amaro", date: "2026-08-17", time: "10:02", low: 63, high: 63 },
  { site: "amaro", date: "2026-08-17", time: "12:06", low: 34.1, high: 34.1 },
  {
    site: "pissebus",
    date: "2026-08-17",
    time: "10:10",
    low: 35.4,
    high: 35.4,
  },
  {
    site: "tolmezzo",
    date: "2026-08-17",
    time: "10:49",
    low: 24.1,
    high: 24.1,
  },
  { site: "amaro", date: "2026-08-18", time: "08:48", low: 13.2, high: 13.2 },
  {
    site: "pissebus",
    date: "2026-08-18",
    time: "08:56",
    low: 17.6,
    high: 17.6,
  },
  {
    site: "tolmezzo",
    date: "2026-08-18",
    time: "09:38",
    low: 10.2,
    high: 10.2,
  },
  { site: "amaro", date: "2026-08-19", time: "08:51", low: 12.3, high: 12.3 },
  {
    site: "pissebus",
    date: "2026-08-19",
    time: "08:58",
    low: 13.8,
    high: 13.8,
  },
  {
    site: "tolmezzo",
    date: "2026-08-19",
    time: "09:33",
    low: 15.3,
    high: 15.3,
  },
];
export const FIRE_DAYS = [
  ...new Set(AIR_OBSERVATIONS.map((o) => o.date)),
].sort();
export const airValue = (o: AirObservation) =>
  o.low === o.high ? String(o.low).replace(".", ",") : `${o.low}–${o.high}`;

/** Difference of measured intervals; the same observation is correlated with itself. */
export function compareAir(a: AirObservation, b: AirObservation) {
  if (a.site === b.site && a.date === b.date && a.time === b.time)
    return { low: 0, high: 0 };
  return { low: b.low - a.high, high: b.high - a.low };
}
