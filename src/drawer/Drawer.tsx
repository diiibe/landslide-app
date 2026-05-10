import type { ReactNode } from "react";
import { useAppStore } from "@/app/store";
import styles from "./Drawer.module.css";

interface Props {
  children: ReactNode;
}

export function Drawer({ children }: Props) {
  const toggle = useAppStore((s) => s.toggleDrawer);
  const open = useAppStore((s) => s.drawerOpen);
  return (
    <>
      <button
        type="button"
        className={styles.handle}
        aria-label="Toggle side panel"
        aria-expanded={open}
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
