import styles from "./App.module.css";

export default function App() {
  return (
    <div className={styles.shell}>
      <header style={{ height: "var(--topbar-h)", borderBottom: "1px solid var(--c-border)", background: "var(--c-surface)" }}>
        <div style={{ padding: "0 16px", lineHeight: "var(--topbar-h)", fontWeight: 600 }}>
          FVG Landslide
        </div>
      </header>
      <div className={styles.body} data-drawer="open">
        <div className={styles.map} aria-label="Map placeholder" />
      </div>
    </div>
  );
}
