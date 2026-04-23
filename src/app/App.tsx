import styles from "./App.module.css";
import { TopBar } from "@/topbar/TopBar";
import { Tabs } from "@/topbar/Tabs";
import { SearchLocality } from "@/topbar/SearchLocality";
import { IconButtons } from "@/topbar/IconButtons";
import { MapView } from "@/map/MapView";
import { ZonesPill } from "@/map-overlays/ZonesPill";
import { LayersPanel } from "@/map-overlays/LayersPanel";
import { Legend } from "@/map-overlays/Legend";

export default function App() {
  return (
    <div className={styles.shell}>
      <TopBar tabs={<Tabs />} search={<SearchLocality />} icons={<IconButtons />} />
      <div className={styles.body} data-drawer="open">
        <div className={styles.map}>
          <MapView />
          <ZonesPill />
          <LayersPanel />
          <Legend />
        </div>
      </div>
    </div>
  );
}
