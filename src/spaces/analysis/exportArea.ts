import type { AnalysisResult } from "./core";
import type { AreaSelection } from "../store";
import type { V2Layer } from "@/app/types";
import { downloadBlob } from "@/lib/export";
export type AreaExportFormat = "geojson" | "csv" | "html" | "json";
const titles: Record<V2Layer, string> = { bodies: "Corpi di frana", diffuse: "Franosità diffusa" };
const NOTE = "Suscettibilità relativa: somiglianza con l’inventario, non probabilità o previsione di frana. I cinque gradi suddividono la precedente classe 5. Fuori fascia alta non significa assenza di suscettibilità.";
export function areaReport(area: AreaSelection, result: AnalysisResult, chosen: Record<V2Layer, number[]>, now = new Date()) {
  return { format: "friulview-area-analysis-v1", area: { id: area.id, name: area.name, geometry: area.geometry, color: area.color ?? "#4d79ae", spaceId: area.spaceId ?? "landslides", createdAt: area.createdAt ?? now.getTime() }, generatedAt: now.toISOString(), source: "HazardFVG · modello v2 · griglia originale", grid: { cellSizeM: 120, analysisCRS: "EPSG:32633", geometryCRS: "EPSG:4326" }, note: NOTE, mapSelection: chosen, result };
}
type Report = ReturnType<typeof areaReport>;
type Row = [string, string, string, number | string, string];
export function areaRows(report: Report): Row[] {
  const rows: Row[] = [];
  const result = report.result;
  for (const layer of ["bodies", "diffuse"] as const) {
    const a = result.layers[layer], add = (indicator: string, value: number | null, unit: string) => rows.push([report.area.name, titles[layer], indicator, value ?? "", unit]);
    add("Superficie totale", result.areaM2, "m2"); add("Superficie mappata", a.coveredM2, "m2");
    add("Senza mappatura", Math.max(0, result.areaM2 - a.coveredM2), "m2");
    add("Mappata sotto la fascia alta", a.belowFocusM2 ?? 0, "m2");
    a.classes.forEach((value, i) => { add(`Grado ${i + 1} · superficie`, value, "m2"); add(`Grado ${i + 1} · quota della superficie mappata`, a.coveredM2 ? value / a.coveredM2 * 100 : null, "%"); });
    for (const key of ["mean", "median", "p90", "min", "max"] as const) add(({ mean: "Punteggio medio", median: "Mediana pesata", p90: "90° percentile", min: "Punteggio minimo", max: "Punteggio massimo" })[key] + " · tutta la superficie mappata", a[key], "score");
    report.result.classification?.edges[layer].forEach((value, i) => add(`Limite ${i} della scala`, value, "score"));
    for (const kind of ["roads", "trails"] as const) {
      const network = result.networks?.[kind]; if (!network) continue;
      const label = kind === "roads" ? "Strade" : "Sentieri", values = layer === "bodies" ? network.bodiesKm : network.diffuseKm;
      add(`${label} · lunghezza totale`, network.totalKm, "km");
      const below = network.belowFocusKm?.[layer] ?? 0;
      add(`${label} · sotto fascia alta`, below, "km"); add(`${label} · senza mappatura`, Math.max(0, (values[0] ?? 0) - below), "km");
      values.slice(1).forEach((value, i) => add(`${label} · grado ${i + 1}`, value, "km"));
    }
  }
  return rows;
}
const escapeHTML = (s: unknown) => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
// Spreadsheet programs must never interpret an area name as a formula.
const csv = (s: unknown) => '"' + (typeof s === "number" ? String(s).replace(".", ",") : String(s).replace(/^[=+\-@]/, "'$&")).replace(/"/g, '""') + '"';
const number = (v: number | string) => typeof v === "number" ? v.toLocaleString("it-IT", { maximumSignificantDigits: 7 }) : v || "Non disponibile";
export function areaExportContent(format: AreaExportFormat, report: Report): { text: string; mime: string; extension: string } {
  if (format === "json") return { text: JSON.stringify(report, null, 2), mime: "application/json", extension: "json" };
  if (format === "geojson") {
    const ring = report.area.geometry.coordinates[0]!, xs = ring.map(p => p[0]!), ys = ring.map(p => p[1]!);
    const properties: Record<string, unknown> = { "fvg:bundle": "polygon", id: report.area.id, name: report.area.name, color: report.area.color, visible: true, spaceId: report.area.spaceId,
      createdAt: report.area.createdAt, bounds: [[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]],
      stats: { areaKm2: report.result.areaM2 / 1e6, cellsVisible: null, cellsAboveThreshold: null, meanP: null, medianP: null, iffiCount: null, threshold: null, model: null, unavailableReason: "Geometria con relazione allegata; ricalcola per leggere la versione corrente." },
      generated_at: report.generatedAt, model_version: report.result.version ?? null, method: report.result.method ?? null, classification: report.result.classification ?? null, analysis: report.result, note: report.note };
    for (const row of areaRows(report)) properties[`${row[1]} | ${row[2]} [${row[4]}]`] = row[3] === "" ? null : row[3];
    return { text: JSON.stringify({ type: "FeatureCollection", meta: { magic: "fvg-landslide-app", version: 1, exportedAt: Date.parse(report.generatedAt), counts: { layers: 0, polygons: 1 } }, features: [{ type: "Feature", properties, geometry: report.area.geometry }] }, null, 2), mime: "application/geo+json", extension: "geojson" };
  }
  if (format === "csv") {
    const rows: (number | string)[][] = [["Area", "Mappatura", "Indicatore", "Valore", "Unità"], ...areaRows(report),
      [report.area.name, "Metadati", "Esportato il", report.generatedAt, "ISO 8601"], [report.area.name, "Metadati", "Versione indice", report.result.version ?? "Non dichiarata", ""],
      [report.area.name, "Metadati", "Metodo", report.result.method ?? "Intersezione in UTM 33N", ""], [report.area.name, "Metadati", "Interpretazione", report.note, ""],
      ...(["bodies", "diffuse"] as const).map(k => [report.area.name, titles[k], "Gradi selezionati sulla mappa", report.mapSelection[k].join(", "), ""]),
      ...(report.result.poi ?? []).map(p => [report.area.name, "Punto di contesto", p.name, `${p.coordinates.join(", ")} · ${p.category}`, "WGS84"]),
    ];
    return { text: "\uFEFF" + rows.map(row => row.map(csv).join(";")).join("\r\n"), mime: "text/csv;charset=utf-8", extension: "csv" };
  }
  const rows = areaRows(report);
  const html = `<!doctype html><html lang="it"><meta charset="utf-8"><title>${escapeHTML(report.area.name)} · Analisi FriulView</title><style>body{font:15px/1.55 system-ui,sans-serif;color:#203126;margin:32px auto;padding:0 20px;max-width:1000px}h1{font-size:26px}h2{font-size:19px;margin-top:28px}table{border-collapse:collapse;width:100%;font-size:13px}th,td{border-bottom:1px solid #b8c5b5;padding:8px;text-align:left}td:nth-child(2){text-align:right;font-variant-numeric:tabular-nums}small{color:#465a4b}.note{padding:16px;background:#edf1e9} @media print{body{margin:0}tr{break-inside:avoid}thead{display:table-header-group}h2{break-after:avoid}}</style><h1>${escapeHTML(report.area.name)}</h1><p>Analisi territoriale · FriulView</p><p class="note">${escapeHTML(report.note)}</p><p><b>Fonte:</b> ${escapeHTML(report.source)}<br><b>Esportazione:</b> ${escapeHTML(new Date(report.generatedAt).toLocaleString("it-IT", { timeZone: "Europe/Rome" }))} · ora italiana<br><b>Versione:</b> ${escapeHTML(report.result.version ?? "Non dichiarata")}<br><b>Metodo:</b> ${escapeHTML(report.result.method ?? "Intersezioni sulla griglia 120 m, UTM 33N")}</p>${(["bodies", "diffuse"] as const).map(k => `<h2>${titles[k]}</h2><p>Gradi accesi sulla mappa: ${escapeHTML(report.mapSelection[k].join(", ") || "nessuno")}. La tabella conserva tutti i gradi.</p><table><thead><tr><th>Indicatore</th><th>Valore</th><th>Unità</th></tr></thead><tbody>${rows.filter(r => r[1] === titles[k]).map(r => `<tr><th>${escapeHTML(r[2])}</th><td>${escapeHTML(number(r[3]))}</td><td>${escapeHTML(r[4] === "m2" ? "m²" : r[4])}</td></tr>`).join("")}</tbody></table>`).join("")}<h2>Copertura e interpretazione</h2><p>Le percentuali dei gradi usano come denominatore tutta la superficie mappata della zona. Le superfici mappate sotto la fascia alta restano distinte dai dati mancanti. Media, mediana e percentili usano tutta la superficie mappata, non soltanto i gradi visibili.</p><p>${report.result.networks ? "Reti OpenStreetMap semplificate di 3 m e campionate in segmenti ≤60 m, tagliati sul confine della zona; non indicano transitabilità o chiusure." : "Strade e sentieri non richiesti in questo calcolo. Apri Contesto e attendi i risultati per includerli nell’esportazione."}</p><h2>Punti di contesto</h2><ul>${(report.result.poi ?? []).map(p => `<li>${escapeHTML(p.name)} · ${escapeHTML(p.category)} · ${escapeHTML(p.coordinates.join(", "))}</li>`).join("") || "<li>Nessun punto incluso nel calcolo.</li>"}</ul><p><small>Per riaprire il perimetro usa l’esportazione GeoJSON. Il CSV si apre in un foglio di calcolo. Questa relazione HTML può essere letta offline e stampata in PDF dal browser.</small></p></html>`;
  return { text: html, mime: "text/html;charset=utf-8", extension: "html" };
}
export function downloadAreaReport(format: AreaExportFormat, report: Report) {
  const output = areaExportContent(format, report);
  const safe = report.area.name.normalize("NFKD").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 70) || "area";
  downloadBlob(new Blob([output.text], { type: output.mime }), `friulview-${safe}-analisi.${output.extension}`);
}

/** Both areas retain their own coverage, bounds and classification metadata. */
export function downloadAreaComparison(format: AreaExportFormat, reports: Report[], selected: { layer: V2Layer; minClass: number }) {
  if (!reports.length) return;
  const files = reports.map(report => areaExportContent(format, report));
  let text: string;
  if (format === "geojson") {
    const collections = files.map(file => JSON.parse(file.text) as { features: GeoJSON.Feature[]; meta: Record<string, unknown> });
    text = JSON.stringify({ type: "FeatureCollection", meta: { ...collections[0]!.meta, counts: { layers: 0, polygons: reports.length }, comparison: selected }, features: collections.flatMap(c => c.features) }, null, 2);
  } else if (format === "csv") {
    text = files[0]!.text + "\r\n" + files.slice(1).map(file => file.text.slice(file.text.indexOf("\r\n") + 2)).join("\r\n");
    text += "\r\n" + ["Confronto", titles[selected.layer], "Grado minimo nella fascia alta", selected.minClass, ""].map(csv).join(";");
  } else if (format === "html") {
    const first = files[0]!.text;
    text = first.slice(0, first.indexOf("<h1>")).replace(/<title>.*?<\/title>/s,"<title>Confronto tra zone · FriulView</title>") + `<h1>Confronto tra zone</h1><p>${titles[selected.layer]} · dal grado ${selected.minClass} nella fascia alta. Ogni tabella conserva il quadro completo di entrambe le mappature.</p>` + files.map(file => `<article>${file.text.slice(file.text.indexOf("<h1>"), file.text.lastIndexOf("</html>"))}</article>`).join("<hr>") + "</html>";
  } else text = JSON.stringify({ format: "friulview-area-comparison-v1", selected, reports }, null, 2);
  downloadBlob(new Blob([text], { type: files[0]!.mime }), `friulview-confronto-zone.${files[0]!.extension}`);
}
