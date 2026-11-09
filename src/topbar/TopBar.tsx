import { Icon } from "@/ui/Icon";
import styles from "./TopBar.module.css";
import { useEffect, useRef, useState, type ReactNode } from "react";
import pkg from "../../package.json";

const APP_VERSION = pkg.version;

interface Props {
  tabs: ReactNode;
  search: ReactNode;
  icons: ReactNode;
}

export function TopBar({ tabs, search, icons }: Props) {
  const [toolsOpen, setToolsOpen] = useState(false);
  const tools = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!toolsOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (!tools.current?.contains(event.target as Node)) setToolsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setToolsOpen(false);
        tools.current?.querySelector("button")?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [toolsOpen]);
  return (
    <header className={styles.bar}>
      <div
        className={styles.brand}
        title={`FVG · Territorio — versione ${APP_VERSION}`}
      >
        <Icon name="map" />
        <span>FVG · Territorio</span>
      </div>
      {tabs}
      <div className={styles.search}>{search}</div>
      <div className={styles.tools} ref={tools}>
        <button
          type="button"
          className={styles.toolsToggle}
          aria-expanded={toolsOpen}
          aria-controls="map-tools"
          onClick={() => setToolsOpen(!toolsOpen)}
        >
          <Icon name="filter" />
          Strumenti
        </button>
        <div
          id="map-tools"
          className={styles.spacer}
          data-open={toolsOpen}
          onClick={(event) => {
            if (
              toolsOpen &&
              (event.target as Element).closest("button[data-close-tools]")
            ) {
              setToolsOpen(false);
              tools.current
                ?.querySelector("button")
                ?.focus({ preventScroll: true });
            }
          }}
        >
          {icons}
        </div>
      </div>
    </header>
  );
}
