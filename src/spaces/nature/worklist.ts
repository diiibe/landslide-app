import { treeId, type TreeFeature } from "./store";
/** Quote every cell and neutralise spreadsheet formula prefixes in user notes/source fields. */
export function csvCell(value: unknown) {
  const text = String(value ?? "");
  return `"${(/^[\s]*[=+\-@\t\r]/.test(text) ? "'" : "") + text.replace(/"/g, '""')}"`;
}
export function parkWorklist(
  trees: TreeFeature[],
  inspections: Record<string, { at: number; note: string }>,
  minutes: number,
) {
  return (
    "\uFEFF" +
    [
      [
        "ordine",
        "id",
        "etichetta",
        "specie_storica",
        "longitudine",
        "latitudine",
        "rilievo_storico",
        "minuti_attivita_ipotizzati",
        "annotazione_demo",
        "data_annotazione_demo",
        "modalita",
      ],
      ...trees.map((t, i) => {
        const check = inspections[treeId(t)];
        return [
          i + 1,
          treeId(t),
          t.properties.prog,
          t.properties.specie,
          ...t.geometry.coordinates.slice(0, 2),
          t.properties.data_rilievo,
          minutes,
          check?.note,
          check ? new Date(check.at).toISOString() : "",
          "Archivio ERPAC storico / esercitazione locale",
        ];
      }),
    ]
      .map((row) => row.map(csvCell).join(";"))
      .join("\r\n")
  );
}
export function downloadWorklist(content: string) {
  const url = URL.createObjectURL(
    new Blob([content], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "friulview-villa-manin-sopralluogo-demo.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
