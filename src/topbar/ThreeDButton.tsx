import { useAppStore } from "@/app/store";
import styles from "./IconButtons.module.css";

/**
 * 3D view toggle. Flips `view3D` in the store; MapView is responsible
 * for wiring the actual MapLibre `setTerrain` + `easeTo({ pitch })`
 * transition to that flag. The icon is a small isometric cube that
 * reads as both "3D" and "perspective" without needing a label.
 */
export function ThreeDButton() {
  const view3D = useAppStore((s) => s.view3D);
  const toggle = useAppStore((s) => s.toggleView3D);
  return (
    <button
      type="button"
      className={styles.btn}
      data-active={view3D}
      title={view3D ? "Switch back to top-down view" : "Tilt to oblique 3D view"}
      aria-label={view3D ? "Disable 3D view" : "Enable 3D view"}
      aria-pressed={view3D}
      onClick={toggle}
    >
      <svg
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {/* Isometric cube: top diamond + two side faces. */}
        <path d="M8 1.6 14.2 5 8 8.4 1.8 5 8 1.6Z" />
        <path d="M1.8 5v6L8 14.4V8.4" />
        <path d="M14.2 5v6L8 14.4" />
      </svg>
    </button>
  );
}
