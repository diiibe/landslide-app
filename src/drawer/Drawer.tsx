import { useEffect, type ReactNode } from "react";
import { useAppStore } from "@/app/store";
import styles from "./Drawer.module.css";

interface Props {
  children: ReactNode;
}

export function Drawer({ children }: Props) {
  const drawerOpen = useAppStore((s) => s.drawerOpen);
  const toggle = useAppStore((s) => s.toggleDrawer);

  // Close drawer on Escape (mobile UX; harmless on desktop where backdrop is hidden).
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches) {
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
        aria-hidden="true"
        onClick={() => {
          if (drawerOpen) toggle();
        }}
      />
      <button
        type="button"
        className={styles.handle}
        aria-label="Toggle side panel"
        aria-expanded={drawerOpen}
        aria-controls="drawer-panel"
        onClick={toggle}
      >
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
      <aside id="drawer-panel" className={`${styles.drawer} drawer`}>{children}</aside>
    </>
  );
}
