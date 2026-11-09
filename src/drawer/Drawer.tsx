import { useExperienceStore } from "@/spaces/store";
import { Icon } from "@/ui/Icon";
import { useEffect, useRef, type ReactNode } from "react";
import { useAppStore } from "@/app/store";
import styles from "./Drawer.module.css";

interface Props {
  children: ReactNode;
  mobileSheet?: boolean;
  label?: string;
  interactiveMap?: boolean;
}

export function Drawer({
  children,
  mobileSheet = false,
  label = "Sulla mappa",
  interactiveMap = false,
}: Props) {
  const preferredOpen = useAppStore((s) => s.drawerOpen);
  const drawing = useAppStore((s) => s.drawingMode);
  const drawerOpen = preferredOpen && !drawing;
  const toggle = useAppStore((s) => s.toggleDrawer);
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    if (
      !drawerOpen &&
      !drawing &&
      panel.current?.contains(document.activeElement)
    )
      document.getElementById("layers-trigger")?.focus();
  }, [drawerOpen, drawing]);

  // Close drawer on Escape (mobile UX; harmless on desktop where backdrop is hidden).
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (
          typeof window !== "undefined" &&
          window.matchMedia(
            "(max-width: 768px), (max-height: 500px) and (pointer: coarse)",
          ).matches
        ) {
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
        data-interactive={interactiveMap}
        aria-hidden="true"
        onClick={() => {
          if (drawerOpen) toggle();
        }}
      />
      <aside
        ref={panel}
        id="drawer-panel"
        className={`${styles.drawer} drawer`}
        aria-label={label}
        aria-hidden={!drawerOpen}
        {...(!drawerOpen ? { inert: "" } : {})}
      >
        <div className={styles.mobileHeader}>
          <div className={styles.heading}>
            <Icon name="layers" />
            <strong>{label}</strong>
          </div>
          <button
            type="button"
            aria-label="Chiudi pannello livelli"
            title="Mostra mappa"
            onClick={toggle}
          >
            <Icon name="close" />
          </button>
        </div>
        {children}
      </aside>
    </>
  );
}

export function LayersButton() {
  const active = useExperienceStore((s) => s.activeId),
    tab = useExperienceStore((s) => s.tab);
  const open = useAppStore((s) => s.drawerOpen),
    drawing = useAppStore((s) => s.drawingMode),
    toggle = useAppStore((s) => s.toggleDrawer);
  return (
    <button
      id="layers-trigger"
      type="button"
      className={styles.stackTrigger}
      hidden={drawing}
      aria-label={
        active && open && tab !== "layers"
          ? "Mostra i livelli dello spazio"
          : open
            ? "Chiudi sulla mappa"
            : "Apri sulla mappa"
      }
      aria-controls="drawer-panel"
      aria-expanded={open}
      onClick={() => {
        const space = useExperienceStore.getState();
        if (space.activeId && open && space.tab !== "layers") {
          useExperienceStore.setState({ tab: "layers" });
          return;
        }
        if (space.activeId) useExperienceStore.setState({ tab: "layers" });
        toggle();
        if (!open)
          document.getElementById("drawer-panel")?.scrollTo?.({ top: 0 });
      }}
    >
      <Icon name="layers" />
      <span>Livelli</span>
      <Icon name="chevron" />
    </button>
  );
}
