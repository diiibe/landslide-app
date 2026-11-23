import { useEffect, useRef, useState } from "react";
import { useAirStore } from "./store";
import { AirDialog } from "./Dialog";
import { airReport, csvCell } from "./reportData";
import css from "./Air.module.css";
function download(text: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type })),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function AirDossier({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [report, setReport] = useState<Awaited<
      ReturnType<typeof airReport>
    > | null>(null),
    [error, setError] = useState<string | null>(null),
    text = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!open) return;
    let current = true;
    void airReport(useAirStore.getState())
      .then((r) => {
        if (current) setReport(r);
      })
      .catch((e) => {
        if (current) setError(String(e));
      });
    return () => {
      current = false;
      setReport(null);
      setError(null);
    };
  }, [open]);
  const json = report ? JSON.stringify(report, null, 2) : "";
  return (
    <AirDialog title="Dossier di studio" open={open} onClose={onClose}>
      <p>
        Conserva i dati e le scelte della sessione, con fonti, date, unità e
        valori mancanti. Non produce automaticamente una spiegazione delle
        cause.
      </p>
      <details>
        <summary>Come funziona e cosa ottieni</summary>
        <ol>
          <li>Scegli Comune, inquinante e settore.</li>
          <li>Imposta centraline A e B, parametro e giorno finale.</li>
          <li>
            Leggi il riepilogo e scarica o copia il JSON. Il CSV contiene le due
            serie ambientali complete, anche senza una coppia confrontabile.
          </li>
        </ol>
      </details>
      {error ? (
        <p role="alert">{error}</p>
      ) : !report ? (
        <p role="status">Preparazione dei dati e del contesto…</p>
      ) : (
        <>
          <section>
            <h3>{report.inventory.municipality}</h3>
            <p>
              {report.inventory.pollutant} · {report.inventory.sector} ·{" "}
              {report.inventory.value ?? "Dato mancante"} t/anno, 2023.
            </p>
          </section>
          <section>
            <h3>Centraline ambientali</h3>
            <p>
              {report.observations.seriesA.name} /{" "}
              {report.observations.seriesB.name}
            </p>
            <p>
              {report.observations.paired.length} date confrontabili. Entrambe
              le serie sono conservate integralmente fino al giorno scelto.
            </p>
          </section>
          <p>
            Il dossier comprende anche l’archivio Fanna in mg/Nm³, i record AIA
            filtrati e il contesto del territorio.
          </p>
          <div className={css.actions}>
            <button
              onClick={() =>
                download(
                  json,
                  "friulview-aria-dossier.json",
                  "application/json",
                )
              }
            >
              Scarica JSON
            </button>
            <button
              onClick={() => {
                const rows = [
                  [
                    "data",
                    "stazione",
                    "parametro",
                    "valore",
                    "unita",
                    "qualita",
                  ],
                  ...report.observations.seriesA.rows.map((r) => [
                    r.date,
                    report.observations.seriesA.name,
                    report.observations.parameter,
                    r.value,
                    "µg/m³",
                    r.valid
                      ? "Stato di validazione non fornito"
                      : "Dato mancante/insufficiente",
                  ]),
                  ...report.observations.seriesB.rows.map((r) => [
                    r.date,
                    report.observations.seriesB.name,
                    report.observations.parameter,
                    r.value,
                    "µg/m³",
                    r.valid
                      ? "Stato di validazione non fornito"
                      : "Dato mancante/insufficiente",
                  ]),
                ];
                download(
                  "\ufeff" +
                    rows.map((r) => r.map(csvCell).join(";")).join("\r\n"),
                  "friulview-aria-centraline.csv",
                  "text/csv;charset=utf-8",
                );
              }}
            >
              Scarica serie CSV
            </button>
            <button
              onClick={() =>
                download(
                  JSON.stringify({
                    type: "FeatureCollection",
                    features: [
                      {
                        type: "Feature",
                        geometry: report.inventory.geometry,
                        properties: report.inventory,
                      },
                    ],
                  }),
                  "friulview-aria-comune.geojson",
                  "application/geo+json",
                )
              }
            >
              GeoJSON del Comune
            </button>
          </div>
          <details>
            <summary>JSON del dossier · seleziona e copia</summary>
            <textarea
              ref={text}
              readOnly
              value={json}
              aria-label="JSON del dossier"
              spellCheck={false}
            />
            <button
              onClick={() => {
                text.current?.focus();
                text.current?.select();
              }}
            >
              Seleziona il JSON
            </button>
          </details>
        </>
      )}
    </AirDialog>
  );
}
