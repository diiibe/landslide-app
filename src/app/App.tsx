import { lazy, Suspense, useEffect, useState, type ComponentType } from "react";
import styles from "./App.module.css";
import { parseUserFile } from "@/lib/upload";
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
  const addUserLayer = useAppStore((s) => s.addUserLayer);

  // Drag & drop on the map area: accept the same file types as the
  // UploadButton. We listen at window level so a drop anywhere on the
  // app shell works; a transient overlay (`dragOver`) hints to the user
  // they can drop.
  const [dragOver, setDragOver] = useState(false);
  useEffect(() => {
    let depth = 0; // dragenter/leave fire per child, so refcount instead of bool
    const acceptable = (e: DragEvent) =>
      !!e.dataTransfer && Array.from(e.dataTransfer.types).includes("Files");
    const onEnter = (e: DragEvent) => {
      if (!acceptable(e)) return;
      depth++;
      setDragOver(true);
    };
    const onLeave = (e: DragEvent) => {
      if (!acceptable(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragOver(false);
    };
    const onOver = (e: DragEvent) => {
      if (!acceptable(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    };
    const onDrop = async (e: DragEvent) => {
      if (!acceptable(e)) return;
      e.preventDefault();
      depth = 0;
      setDragOver(false);
      const files = Array.from(e.dataTransfer?.files ?? []);
      let lastBounds: [[number, number], [number, number]] | null = null;
      for (const file of files) {
        try {
          const parsed = await parseUserFile(file);
          const layer = addUserLayer(parsed);
          if (layer.bounds) lastBounds = layer.bounds;
        } catch {
          // Per-file failures are swallowed here so a bad file doesn't
          // abort the rest of the batch; the topbar button surfaces
          // errors when invoked via picker. Drop is "fire and forget".
        }
      }
      if (lastBounds) {
        window.dispatchEvent(
          new CustomEvent("fvg:fitbounds", {
            detail: { bounds: lastBounds, padding: 80 },
          }),
        );
      }
    };
    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("dragover", onOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("drop", onDrop);
    };
  }, [addUserLayer]);

  return (
    <div className={styles.shell}>
      {dragOver && (
        <div className={styles.dropZone} aria-hidden="true">
          <span>Drop GPX, GeoJSON, or KML to add as a layer</span>
        </div>
      )}
      <TopBar tabs={null} search={<SearchLocality />} icons={<IconButtons />} />
      <div className={styles.body} data-drawer={drawerOpen ? "open" : "closed"}>
        <div className={styles.map}>
          <Suspense fallback={<MapSkeleton />}>
            <MapView />
          </Suspense>
          <ZonesPill />
          <ThresholdControl />
          <LayersPanel />
          <div className={styles.rightOverlays}>
            <SensitivityPanel />
            <ComuneFilterPanel />
          </div>
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
