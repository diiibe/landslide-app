import type { CSSProperties, ReactNode } from "react";
import styles from "./widgets.module.css";

interface Props {
  title?: string | undefined;
  className?: string | undefined;
  style?: CSSProperties | undefined;
  children: ReactNode;
}

export function Section({ title, className = "", style, children }: Props) {
  return (
    <section className={`${styles.section} ${className}`} style={style}>
      {title && <h3>{title}</h3>}
      {children}
    </section>
  );
}
