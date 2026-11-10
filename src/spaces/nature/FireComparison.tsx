import { useState } from "react";
import { Select } from "@/ui/Select";
import { Icon } from "@/ui/Icon";
import { exportReport } from "../tools/exportReport";
import {
  AIR_OBSERVATIONS,
  AIR_SITES,
  FIRE_DAYS,
  FIRE_SOURCES,
  airValue,
  compareAir,
} from "./fire";
import { useNatureStore } from "./store";
import { focusAt } from "../navigation";
import { number, date } from "./format";
import css from "./Nature.module.css";

type Observation = (typeof AIR_OBSERVATIONS)[number];
export function FireComparison() {
  const [station, setStation] = useState("pissebus");
  const points = AIR_OBSERVATIONS.filter((o) => o.site === station);
  const [aIndex, setA] = useState(0),
    [bIndex, setB] = useState(-1);
  const ai = Math.min(aIndex, points.length - 1),
    bi = bIndex < 0 ? points.length - 1 : Math.min(bIndex, points.length - 1);
  const a = points[ai]!,
    b = points[bi]!,
    delta = compareAir(a, b);
  const label = (o: Observation) =>
    `${date(o.date)} · ${o.time} · ${airValue(o)} µg/m³`;
  const options = points.map((o, i) => ({ value: String(i), label: label(o) }));
  const signed = (v: number) =>
    `${v > 0 ? "+" : v < 0 ? "−" : ""}${number(Math.abs(v))}`;
  return (
    <section
      className={css.section}
      aria-label="Confronto di due campioni PM10"
    >
      <h3>Confronta due campioni PM10</h3>
      <label>
        Località
        <Select
          label="Località del confronto PM10"
          value={station}
          onChange={(v) => {
            setStation(v);
            setA(0);
            setB(-1);
          }}
          options={AIR_SITES.map((s) => ({ value: s.id, label: s.name }))}
        />
      </label>
      <label>
        Campione iniziale
        <Select
          label="Campione iniziale PM10"
          value={String(ai)}
          onChange={(v) => setA(Number(v))}
          options={options}
        />
      </label>
      <label>
        Campione finale
        <Select
          label="Campione finale PM10"
          value={String(bi)}
          onChange={(v) => setB(Number(v))}
          options={options}
        />
      </label>
      <div className={css.result} role="status">
        <strong>Differenza finale − iniziale</strong>
        <output>
          {delta.low === delta.high
            ? signed(delta.low)
            : `${signed(delta.low)} a ${signed(delta.high)}`}{" "}
          µg/m³
        </output>
        <p>
          {ai === bi
            ? "Hai selezionato lo stesso campione: scegli due prelievi diversi."
            : delta.high < 0
              ? "Il campione finale ha valori inferiori all’intero intervallo iniziale."
              : delta.low > 0
                ? "Il campione finale ha valori superiori all’intero intervallo iniziale."
                : "Gli intervalli si sovrappongono: la differenza include lo zero."}
        </p>
        <small>
          Misure istantanee con orari diversi, non medie giornaliere. Il
          confronto non misura esposizione, superamenti normativi o cause della
          variazione.
        </small>
      </div>
      <button
        onClick={() => {
          useNatureStore.setState({
            fireDay: FIRE_DAYS.indexOf(b.date),
            firePlaying: false,
            showAir: true,
          });
          focusAt(AIR_SITES.find((s) => s.id === station)!.coordinates, 14);
        }}
      >
        <Icon name="map" />
        Mostra località e giorno finale
      </button>
      <small>
        La mappa mostra tutti i campioni disponibili nella località e nel giorno
        finale.
      </small>
      <button
        disabled={ai === bi}
        onClick={() =>
          exportReport("confronto-pm10", {
            mode: "historical-samples",
            source: FIRE_SOURCES.arpa,
            site: station,
            initial: a,
            final: b,
            differenceMicrogramsM3: delta,
            note: "Intervalli osservati; nessuna media giornaliera o deduzione causale.",
          })
        }
      >
        <Icon name="fileData" />
        Esporta questo confronto
      </button>
    </section>
  );
}
