import { useEffect, useRef, type ReactNode } from "react";
import { useAppStore } from "@/app/store";
import styles from "./Drawer.module.css";

interface Props {
  children: ReactNode;
  mobileSheet?: boolean;
  label?: string;
  triggerLabel?: string;
  summary?: string | undefined;
}

export function Drawer({ children, mobileSheet = false, label = "Analisi della mappa", triggerLabel = "Analisi", summary }: Props) {
  const drawerOpen = useAppStore((s) => s.drawerOpen);
  const toggle = useAppStore((s) => s.toggleDrawer);
  const handle = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!drawerOpen && panel.current?.contains(document.activeElement))
      handle.current?.focus();
  }, [drawerOpen]);

  // Close drawer on Escape (mobile UX; harmless on desktop where backdrop is hidden).
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (typeof window !== "undefined" && window.matchMedia("(max-width: 768px), (max-height: 500px) and (pointer: coarse)").matches) {
          toggle();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen, toggle]);

  return (
    <>
      <div
        className={styles.backdrop}
        data-drawer={drawerOpen ? "open" : "closed"}
        data-sheet={mobileSheet}
        aria-hidden="true"
        onClick={() => {
          if (drawerOpen) toggle();
        }}
      />
      <button
        type="button"
        ref={handle}
        className={styles.handle}
        data-sheet={mobileSheet}
        data-open={drawerOpen}
        aria-label={drawerOpen ? `Chiudi ${label.toLowerCase()}` : `Apri ${label.toLowerCase()}`}
        aria-expanded={drawerOpen}
        aria-controls="drawer-panel"
        onClick={() => {
          toggle();
          if (!drawerOpen) panel.current?.scrollTo?.({ top: 0 });
        }}
      >
        <span className={styles.handleLabel}>{triggerLabel}{summary && <span> · {summary}</span>}</span>
        <svg
          viewBox="0 0 10 10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="3,2 7,5 3,8" />
        </svg>
      </button>
      <aside
        ref={panel}
        id="drawer-panel"
        className={`${styles.drawer} drawer`}
        aria-label={label}
        aria-hidden={!drawerOpen}
        {...(!drawerOpen ? { inert: "" } : {})}
      >
        <div className={styles.mobileHeader}>
          <strong>{label}</strong>
          <button type="button" onClick={toggle}>Mostra mappa <span aria-hidden="true">×</span></button>
        </div>
        {children}
      </aside>
    </>
  );
}
