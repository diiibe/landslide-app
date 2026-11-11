import { BrandClock } from "./BrandClock";
import { Icon } from "@/ui/Icon";
import styles from "./TopBar.module.css";
import type { ReactNode } from "react";
import pkg from "../../package.json";

export function TopBar({ tabs, search, icons }: { tabs: ReactNode; search: ReactNode; icons: ReactNode }) {
  return (
    <header className={styles.bar}>
      <div className={styles.brand}><Icon name="brand" /><span className={styles.wordmark}>FriulView<BrandClock /></span></div>
      <nav className={styles.navigation} aria-label="Esplora FriulView">{tabs}</nav>
      <div className={styles.search}>{search}</div>
      <div className={styles.actions}>{icons}<span className={styles.version} aria-label={`Versione ${pkg.version}`} title={`FriulView · versione ${pkg.version}`}>v{pkg.version}</span></div>
    </header>
  );
}
