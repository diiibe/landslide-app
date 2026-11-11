import { useUIText } from "@/ui/interfaceSettings";
import { BrandClock } from "./BrandClock";
import { Icon } from "@/ui/Icon";
import styles from "./TopBar.module.css";
import type { ReactNode } from "react";
import pkg from "../../package.json";

export function TopBar({ tabs, search, icons }: { tabs: ReactNode; search: ReactNode; icons: ReactNode }) {
  const brand = useUIText("brand");
  return (
    <header className={styles.bar} data-ui="navbar">
      <div className={styles.brand} data-ui-part="brand"><Icon name="brand" /><span className={styles.wordmark} data-ui-part="wordmark"><span data-ui-part="brand-label">{brand}</span><BrandClock /></span></div>
      <nav className={styles.navigation} aria-label="Esplora FriulView">{tabs}</nav>
      <div className={styles.search}>{search}</div>
      <div className={styles.actions}>{icons}<span className={styles.version} aria-label={`Versione ${pkg.version}`} title={`FriulView · versione ${pkg.version}`}>v{pkg.version}</span></div>
    </header>
  );
}
