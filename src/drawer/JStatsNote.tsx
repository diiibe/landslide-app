import { Section } from "./widgets/Section";
import styles from "./ModelPanel.module.css";

/** Stand-in for the J.2/J.3 drawer groups (View, Monitoring, Analytics,
 *  Model) while a model v2 layer is the visible surface: their numbers
 *  describe J cells and zones, so they must not sit next to a v2 map. */
export function JStatsNote() {
  return (
    <Section className={styles.v2Note}>
      <p className={styles.v2NoteText}>
        Statistiche disponibili per J.2/J.3. Il modello v2 non ha zone.
      </p>
    </Section>
  );
}
