import { LANDSLIDE_CLASSES, classSelectionText } from "@/lib/landslideClasses";
import { v2ClassColor } from "@/map/layers/modelV2";
import styles from "./LandslideClassPicker.module.css";
export function LandslideClassPicker({ value, onChange, count = 5, label = "Classi visibili" }: {
  value: number[]; onChange: (value: number[]) => void; count?: number; label?: string;
}) {
  return <fieldset className={styles.picker}>
    <legend>{label}</legend>
    <div className={styles.options}>
      {LANDSLIDE_CLASSES.filter(c => c <= count).map(c => <label key={c}>
        <input type="checkbox" aria-label={`Classe ${c}`} checked={value.includes(c)} onChange={() => onChange(value.includes(c) ? value.filter(n => n !== c) : [...value, c])}/>
        <span><i style={{ background: v2ClassColor(c, count) }} aria-hidden="true"/><b>{c}</b><svg viewBox="0 0 12 12" aria-hidden="true"><path d="m2 6 2.5 2.5L10 3"/></svg></span>
      </label>)}
    </div>
    <p>{classSelectionText(value)} · le altre sono trasparenti.</p>
  </fieldset>;
}
