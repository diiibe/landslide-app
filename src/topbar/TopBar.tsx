import { useUIText } from "@/ui/interfaceSettings";
import { BrandClock } from "./BrandClock";
import { Icon } from "@/ui/Icon";
import styles from "./TopBar.module.css";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import pkg from "../../package.json";

export function TopBar({ tabs, search, icons }: { tabs: ReactNode; search: ReactNode; icons: ReactNode }) {
  const brand = useUIText("brand");
  const bar=useRef<HTMLElement>(null),actions=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{
    const measure=()=>{const width=actions.current?.getBoundingClientRect().width;if(width)bar.current?.style.setProperty("--navbar-actions-clearance",`${Math.ceil(width)+12}px`);};
    measure();
    const observer=typeof ResizeObserver==="undefined"?null:new ResizeObserver(measure);
    if(actions.current)observer?.observe(actions.current);
    window.addEventListener("resize",measure);
    return()=>{observer?.disconnect();window.removeEventListener("resize",measure);};
  },[]);
  return (
    <header ref={bar} className={styles.bar} data-ui="navbar">
      <div className={styles.brand} data-ui-part="brand"><Icon name="brand" /><span className={styles.wordmark} data-ui-part="wordmark"><span data-ui-part="brand-label">{brand}</span><BrandClock /></span></div>
      <nav className={styles.navigation} aria-label="Esplora FriulView">{tabs}</nav>
      <div className={styles.search}>{search}</div>
      <div ref={actions} className={styles.actions}>{icons}<span className={styles.version} aria-label={`Versione ${pkg.version}`} title={`FriulView · versione ${pkg.version}`}>v{pkg.version}</span></div>
    </header>
  );
}
