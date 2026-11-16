import { useState } from "react";
import { useAppStore } from "@/app/store";
import { selectedClasses } from "@/lib/landslideClasses";
import { Select } from "@/ui/Select";
import { Icon } from "@/ui/Icon";
import type { AreaSelection } from "../store";
import type { AnalysisResult } from "./core";
import { areaReport, downloadAreaReport, type AreaExportFormat } from "./exportArea";
import styles from "../Panel.module.css";
export function AreaExport({ area, result, disabled = false }: { area: AreaSelection; result: AnalysisResult; disabled?: boolean }) {
  const [format, setFormat] = useState<AreaExportFormat>("geojson"), [done, setDone] = useState(false);
  const settings = useAppStore(s => s.susceptibilityStyle);
  const hints: Record<AreaExportFormat, string> = {
    geojson: "Perimetro WGS84 con statistiche, soglie e metadati. Aprilo in QGIS oppure reimportalo con Strumenti → Esporta/importa → Importa archivio FVG.",
    csv: "Tabelle di entrambe le mappature con superfici in m², quote in %, lunghezze in km e versione dell’indice. Apribile in Excel o LibreOffice.",
    html: "Relazione leggibile offline, con tabelle, copertura e metodo. Aprila nel browser e usa Stampa per salvarla in PDF.",
    json: "Geometria e risultato analitico completo per elaborazioni successive; include selezione dei gradi e versione dei dati.",
  };
  return <details className={styles.export}>
    <summary><Icon name="fileData"/>Esporta area e risultati</summary>
    <label className={styles.field}>Formato<Select label="Formato esportazione area" value={format} onChange={v => { setFormat(v as AreaExportFormat); setDone(false); }} options={[{value:"geojson",label:"GeoJSON · perimetro e dati"},{value:"csv",label:"CSV · tabelle e unità"},{value:"html",label:"Relazione · leggibile e stampabile"},{value:"json",label:"JSON · analisi completa"}]}/></label>
    <p className={styles.caption}>{hints[format]}</p>
    <p className={styles.caption}>{result.networks ? "Include strade, sentieri e punti di contesto richiesti nell’analisi." : "Per includere anche strade, sentieri e punti, apri prima Contesto e attendi il calcolo."}</p>
    <button disabled={disabled} onClick={() => { downloadAreaReport(format, areaReport(area, result, { bodies: selectedClasses(settings.bodies), diffuse: selectedClasses(settings.diffuse) })); setDone(true); }}><Icon name="fileData"/>Scarica {format === "html" ? "relazione" : format.toUpperCase()}</button>
    {done && <p role="status" className={styles.caption}>File preparato. Su mobile lo trovi tra i download o nell’anteprima del browser.</p>}
  </details>;
}
