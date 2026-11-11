import { useUIText } from "@/ui/interfaceSettings";
import { useEffect, useRef } from "react";
import { useAppStore } from "@/app/store";
import { Icon } from "@/ui/Icon";
import { experience } from "./experiences";
import { useExperienceStore } from "./store";
import styles from "@/drawer/Drawer.module.css";

export function ExtensionsButton() {
  const label = useUIText("extensions");
  const active = useExperienceStore(s => s.activeId);
  const tab = useExperienceStore(s => s.tab);
  const hubOpen = useExperienceStore(s => s.hubOpen);
  const drawerOpen = useAppStore(s => s.drawerOpen);
  const drawing = useAppStore(s => s.drawingMode);
  const focusRequested = useRef(false);
  const open = !!active && drawerOpen && !drawing && tab === "tools";

  useEffect(() => {
    if (!open || !focusRequested.current) return;
    const frame = requestAnimationFrame(() => {
      focusRequested.current = false;
      const panel = document.getElementById("drawer-panel");
      panel?.scrollTo?.({ top: 0 });
      const heading = panel?.querySelector<HTMLElement>("h2");
      if (heading) {
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [open, active]);

  return (
    <button
      id="extensions-trigger"
      type="button"
      className={styles.stackTrigger}
      hidden={drawing}
      aria-label={label}
      aria-expanded={active ? open : hubOpen}
      aria-controls={active ? "drawer-panel" : undefined}
      aria-haspopup={active ? undefined : "dialog"}
      title={active ? `Estensioni · ${experience(active)?.title}` : "Scegli uno Spazio per esplorare le sue estensioni"}
      onClick={event => {
        if (!active) {
          event.currentTarget.focus({ preventScroll: true });
          useExperienceStore.setState({ hubOpen: true });
          return;
        }
        focusRequested.current = !open;
        useExperienceStore.setState({ tab: "tools" });
        useAppStore.setState({ drawerOpen: !open });
      }}
    >
      <Icon name="extensions" />
      <span>{label}</span>
      <Icon name="chevron" />
    </button>
  );
}
