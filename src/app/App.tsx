import styles from "./App.module.css";
import { TopBar } from "@/topbar/TopBar";

export default function App() {
  return (
    <div className={styles.shell}>
      <TopBar tabs={null} search={null} icons={null} />
      <div className={styles.body} data-drawer="open">
        <div className={styles.map} aria-label="Map placeholder" />
      </div>
    </div>
  );
}
