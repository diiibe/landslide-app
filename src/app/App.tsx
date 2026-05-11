import { lazy, Suspense, useEffect, type ComponentType } from "react";
import styles from "./App.module.css";
import { TopBar } from "@/topbar/TopBar";
import { SearchLocality } from "@/topbar/SearchLocality";
import { IconButtons } from "@/topbar/IconButtons";
// MapView is lazy-loaded so maplibre-gl + pmtiles ship as a separate
// vendor chunk (see vite.config.ts manualChunks). The chrome paints
// instantly while the ~250 KB map bundle streams in.
//
// In test mode (vitest) we resolve the module eagerly via top-level await
// so the integration test (which uses vi.mock to stub MapView) can render
// the stub synchronously without dealing with Suspense fallbacks. The
// production build dead-code-eliminates this branch because
// `import.meta.env.MODE` is statically replaced by Vite.
const MapView: ComponentType = import.meta.env.MODE === "test"
  ? (await import("@/map/MapView")).MapView
  : lazy(() =>
      import("@/map/MapView").then((m) => ({ default: m.MapView })),
    );
import { ZonesPill } from "@/map-overlays/ZonesPill";
import { LayersPanel } from "@/map-overlays/LayersPanel";
import { SensitivityPanel } from "@/map-overlays/SensitivityPanel";
import { ComuneFilterPanel } from "@/map-overlays/ComuneFilterPanel";
import { Legend } from "@/map-overlays/Legend";
import { ThresholdControl } from "@/map-overlays/ThresholdControl";
import { Drawer } from "@/drawer/Drawer";
import { Group } from "@/drawer/Group";
import { ViewPanel } from "@/drawer/ViewPanel";
import { MonitoringPanel } from "@/drawer/MonitoringPanel";
import { AnalyticsPanel } from "@/drawer/AnalyticsPanel";
import { ModelPanel } from "@/drawer/ModelPanel";
import { useAppStore } from "@/app/store";

export default function App() {
  const drawerOpen = useAppStore((s) => s.drawerOpen);
  // The SensitivityPanel and ComuneFilterPanel share the same right-edge
  // column. When the Sensitivity one is mounted (roads or trails on),
  // the Comune one needs to shift down to clear it. Coordinate via a
  // body class the CSS modules pick up with a `:global(...)` selector.
  const sensitivityMounted = useAppStore(
    (s) => s.layers.roads || s.layers.trails,
  );
  useEffect(() => {
    document.body.classList.toggle("has-sensitivity-panel", sensitivityMounted);
    return () => document.body.classList.remove("has-sensitivity-panel");
  }, [sensitivityMounted]);

  return (
    <div className={styles.shell}>
      <TopBar tabs={null} search={<SearchLocality />} icons={<IconButtons />} />
      <div className={styles.body} data-drawer={drawerOpen ? "open" : "closed"}>
        <div className={styles.map}>
          <Suspense fallback={<MapSkeleton />}>
            <MapView />
          </Suspense>
          <ZonesPill />
          <ThresholdControl />
          <LayersPanel />
          <SensitivityPanel />
          <ComuneFilterPanel />
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

function MapSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading map"
      style={{
        position: "absolute",
        inset: 0,
        background: "var(--c-bg-paper, #f5efe2)",
      }}
    />
  );
}
