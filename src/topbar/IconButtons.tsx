import { useAppStore } from "@/app/store";
import styles from "./IconButtons.module.css";

export function IconButtons() {
  const theme = useAppStore((s) => s.theme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      className={styles.btn}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      aria-pressed={isDark}
      onClick={toggleTheme}
    >
      {isDark ? (
        // Sun (currently dark → click to go light)
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="8" cy="8" r="2.6" />
          <path d="M8 1.4v1.8M8 12.8v1.8M2.4 8h1.8M11.8 8h1.8M3.6 3.6l1.3 1.3M11.1 11.1l1.3 1.3M3.6 12.4l1.3-1.3M11.1 4.9l1.3-1.3" />
        </svg>
      ) : (
        // Moon
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13.5 9.4A5.6 5.6 0 0 1 6.6 2.5a5.6 5.6 0 1 0 6.9 6.9Z" />
        </svg>
      )}
    </button>
  );
}
