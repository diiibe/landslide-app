import styles from "./App.module.css";
import { TopBar } from "@/topbar/TopBar";
import { Tabs } from "@/topbar/Tabs";
import { SearchLocality } from "@/topbar/SearchLocality";
import { IconButtons } from "@/topbar/IconButtons";
import { MapView } from "@/map/MapView";
import { ZonesPill } from "@/map-overlays/ZonesPill";
import { LayersPanel } from "@/map-overlays/LayersPanel";
import { Legend } from "@/map-overlays/Legend";
import { Drawer } from "@/drawer/Drawer";
import { Group } from "@/drawer/Group";
import { ViewPanel } from "@/drawer/ViewPanel";
import { MonitoringPanel } from "@/drawer/MonitoringPanel";
import { AnalyticsPanel } from "@/drawer/AnalyticsPanel";
import { ModelPanel } from "@/drawer/ModelPanel";
import { useAppStore } from "@/app/store";

export default function App() {
  const drawerOpen = useAppStore((s) => s.drawerOpen);
  return (
    <div className={styles.shell}>
      <TopBar tabs={<Tabs />} search={<SearchLocality />} icons={<IconButtons />} />
      <div className={styles.body} data-drawer={drawerOpen ? "open" : "closed"}>
        <div className={styles.map}>
          <MapView />
          <ZonesPill />
          <LayersPanel />
          <Legend />
        </div>
        <Drawer>
          <Group id="view" label="View"><ViewPanel /></Group>
          <Group id="monitoring" label="Monitoring"><MonitoringPanel /></Group>
          <Group id="analytics" label="Analytics"><AnalyticsPanel /></Group>
          <Group id="model" label="Model"><ModelPanel /></Group>
        </Drawer>
      </div>
    </div>
  );
}
