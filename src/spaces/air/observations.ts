import type { AirData, Measure, Station, Observation } from "./types";
export const AIR_ENDPOINTS: Record<Measure, { id: string; field: string }> = {
  pm10: { id: "qp5k-6pvm", field: "media_giornaliera" },
  pm25: { id: "d63p-pqpr", field: "media_giornaliera" },
  no2: { id: "ke9b-p6z2", field: "media_oraria_max" },
};
export function parseObservation(
  row: Record<string, unknown>,
  field: string,
): Observation | null {
  const date = String(row.data_misura ?? "").slice(0, 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(Date.parse(date + "T00:00:00Z")) ||
    new Date(date + "T00:00:00Z").toISOString().slice(0, 10) !== date ||
    date > new Date().toISOString().slice(0, 10)
  )
    return null;
  const raw = row[field] == null ? null : String(row[field]),
    n = raw !== null && raw.trim() !== "" ? Number(raw.replace(",", ".")) : NaN,
    insufficient = /true|vero|^1$/i.test(String(row.dati_insuff ?? ""));
  return {
    date,
    value: !insufficient && Number.isFinite(n) && n >= 0 ? n : null,
    raw,
    valid: !insufficient && Number.isFinite(n) && n >= 0,
    insufficient,
    maxHour:
      row.ora_media_oraria_max == null
        ? null
        : String(row.ora_media_oraria_max),
    validation:
      "Stato di validazione giornaliera/mensile/annuale non fornito dall’API",
  };
}
export function mergeAirObservations(
  stations: Station[],
  measure: Measure,
  rows: Record<string, unknown>[],
) {
  const field = AIR_ENDPOINTS[measure].field;
  let recognized = 0;
  const result = stations.map((station) => {
    const matching = rows.filter(
      (r) => String(r.ubicazione ?? "").trim() === station.name.trim(),
    );
    if (!matching.length) return station;
    const parsed = new Map<string, Observation>();
    for (const row of matching) {
      if (!/^(ug\/m3|µg\/m³|μg\/m³)$/i.test(String(row.unita_misura ?? "")))
        continue;
      const obs = parseObservation(row, field);
      if (obs) {
        recognized++;
        const old = parsed.get(obs.date);
        if (old && JSON.stringify(old) !== JSON.stringify(obs))
          throw new Error("Osservazioni duplicate discordanti nella fonte");
        parsed.set(obs.date, obs);
      }
    }
    if (!parsed.size) return station;
    const all = new Map(
      (station.series[measure] ?? []).map((r) => [r.date, r]),
    );
    for (const [date, row] of parsed) all.set(date, row);
    return {
      ...station,
      series: {
        ...station.series,
        [measure]: [...all.values()].sort((a, b) =>
          a.date.localeCompare(b.date),
        ),
      },
    };
  });
  if (!recognized)
    throw Error(
      "Nessuna osservazione riconoscibile per le centraline dello Spazio",
    );
  return result;
}
export function preserveNewerSeries(
  incoming: AirData,
  current: AirData | null,
) {
  if (!current) return incoming;
  const retained = new Set(
    (Object.keys(AIR_ENDPOINTS) as Measure[]).filter(
      (k) =>
        Date.parse(current.sourceStatus[k]?.retrievedAt ?? "") >
        Date.parse(
          incoming.sourceStatus[k]?.retrievedAt ?? incoming.retrievedAt,
        ),
    ),
  );
  if (!retained.size) return incoming;
  const sourceStatus = { ...incoming.sourceStatus };
  for (const key of retained) sourceStatus[key] = current.sourceStatus[key]!;
  return {
    ...incoming,
    sourceStatus,
    stations: incoming.stations.map((st) => {
      const previous = current.stations.find((v) => v.id === st.id);
      return previous
        ? {
            ...st,
            series: {
              ...st.series,
              ...Object.fromEntries(
                [...retained].map((key) => [
                  key,
                  previous.series[key] ?? st.series[key],
                ]),
              ),
            },
          }
        : st;
    }),
  };
}
export function validData(d: AirData) {
  if (
    !Array.isArray(d.stations) ||
    !d.stations.length ||
    d.municipalities?.type !== "FeatureCollection" ||
    !d.municipalities.features.length ||
    d.aia?.type !== "FeatureCollection" ||
    !Array.isArray(d.sme) ||
    !Array.isArray(d.sources)
  )
    throw Error("Archivio dello Spazio non valido");
  for (const s of d.stations)
    if (
      !s.id ||
      !s.name ||
      s.coordinates.length !== 2 ||
      !s.coordinates.every(Number.isFinite)
    )
      throw Error("Posizione centralina non valida");
  return d;
}
