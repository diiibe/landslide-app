import type { ReactNode } from "react";
import { Icon, type IconName } from "@/ui/Icon";
import { selectObject } from "../store";
import { focusAt } from "../navigation";
import css from "./Nature.module.css";
export function Header({
  title,
  icon,
  children,
  inspection = false,
}: {
  title: string;
  icon: IconName;
  children: ReactNode;
  inspection?: boolean;
}) {
  return (
    <header className={css.header}>
      <Icon name={icon} />
      <div>
        <h2 data-space-inspection={inspection || undefined}>{title}</h2>
        <p className={css.muted}>{children}</p>
      </div>
    </header>
  );
}
export function Method({ children }: { children: ReactNode }) {
  return (
    <details>
      <summary>Provenienza, metodo e limiti</summary>
      {children}
    </details>
  );
}
export function Stats({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className={css.stats}>
      {items.map(([name, value]) => (
        <div key={name}>
          <dt>{name}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
export function InspectBack() {
  return (
    <button className={css.back} onClick={() => selectObject(null)}>
      <Icon name="arrow" />
      Torna alla panoramica
    </button>
  );
}
export function Locate({
  coordinates,
  zoom = 16,
}: {
  coordinates: [number, number];
  zoom?: number;
}) {
  return (
    <button onClick={() => focusAt(coordinates, zoom)}>
      <Icon name="map" />
      Mostra sulla mappa
    </button>
  );
}
export function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: () => void;
}) {
  return (
    <button className={css.checkrow} aria-pressed={value} onClick={onChange}>
      {label}
      <Icon name={value ? "check" : "plus"} />
    </button>
  );
}
