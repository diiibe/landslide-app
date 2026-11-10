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
  beforeLocate,
}: {
  coordinates: [number, number];
  zoom?: number;
  beforeLocate?: () => void;
}) {
  return (
    <button
      onClick={() => {
        beforeLocate?.();
        focusAt(coordinates, zoom);
      }}
    >
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

/** Select one concrete task; keep controls and results in the same panel. */
export function ToolNav<T extends string>({
  value,
  onChange,
  items,
}: {
  value: T;
  onChange: (value: T) => void;
  items: { id: T; title: string; description: string; icon: IconName }[];
}) {
  return (
    <nav className={css.toolNav} aria-label="Strumenti dello Spazio">
      {items.map((item) => (
        <button
          key={item.id}
          aria-pressed={item.id === value}
          onClick={() => onChange(item.id)}
        >
          <Icon name={item.icon} />
          <span>
            <strong>{item.title}</strong>
            <small>{item.description}</small>
          </span>
          <Icon name={item.id === value ? "check" : "chevron"} />
        </button>
      ))}
    </nav>
  );
}
