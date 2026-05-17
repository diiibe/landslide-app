import styles from "./TopBar.module.css";
import type { ReactNode } from "react";
import pkg from "../../package.json";

const APP_VERSION = pkg.version;

interface Props {
  tabs: ReactNode;
  search: ReactNode;
  icons: ReactNode;
}

export function TopBar({ tabs, search, icons }: Props) {
  return (
    <header className={styles.bar}>
      <div className={styles.brand}>
        <span>FVG Landslide</span>
        <span className={styles.version} title={`Build version ${APP_VERSION}`}>
          v{APP_VERSION}
        </span>
      </div>
      {tabs}
      {search}
      <div className={styles.spacer}>{icons}</div>
    </header>
  );
}
