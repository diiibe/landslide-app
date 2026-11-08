import type { CSSProperties, ReactNode } from "react";
import styles from "./widgets.module.css";

interface Props {
  title?: string | undefined;
  /** Accessible name; makes the section a landmark region. */
  ariaLabel?: string | undefined;
  className?: string | undefined;
  style?: CSSProperties | undefined;
  children: ReactNode;
}

export function Section({ title, ariaLabel, className = "", style, children }: Props) {
  return (
    <section className={`${styles.section} ${className}`} style={style} aria-label={ariaLabel}>
      {title && <h3>{title}</h3>}
      {children}
    </section>
  );
}
