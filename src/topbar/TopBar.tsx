import styles from "./TopBar.module.css";
import type { ReactNode } from "react";

interface Props {
  tabs: ReactNode;
  search: ReactNode;
  icons: ReactNode;
}

export function TopBar({ tabs, search, icons }: Props) {
  return (
    <header className={styles.bar}>
      <div className={styles.brand}>FVG Landslide</div>
      {tabs}
      {search}
      <div className={styles.spacer}>{icons}</div>
    </header>
  );
}
