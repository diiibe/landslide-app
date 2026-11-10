import { lazy, Suspense, useEffect, useRef, useState, type ComponentType } from "react";
import styles from "./App.module.css";
import { SpacePanel } from "@/spaces/SpacePanel";
import { SpaceBar } from "@/spaces/SpaceBar";
import { SpaceRuntime } from "@/spaces/Runtime";
import { useExperienceStore } from "@/spaces/store";
import { experience } from "@/spaces/experiences";
import { CatalogButton, CatalogBrowser } from "@/regional/CatalogBrowser";
import { RegionalRuntime } from "@/regional/Runtime";
import { TwinRuntime } from "@/digital-twin/Runtime";
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
const MapView: ComponentType =
  import.meta.env.MODE === "test"
    ? (await import("@/map/MapView")).MapView
    : lazy(() => import("@/map/MapView").then((m) => ({ default: m.MapView })));
import { BasemapPanel } from "@/map-overlays/BasemapPanel";
import { DrawingPanel } from "@/map-overlays/DrawingPanel";
import { Legend } from "@/map-overlays/Legend";
import { SpacesButton } from "@/ui/Spaces";
import { MapTools } from "@/map-overlays/MapTools";
import { ExtensionsButton } from "@/spaces/ExtensionsButton";
import { useControlClearance } from "@/map-overlays/useControlClearance";
import { ThreeDButton } from "@/topbar/ThreeDButton";
import { Drawer, LayersButton } from "@/drawer/Drawer";
import { useAppStore } from "@/app/store";

export default function App() {
  const activeSpace = useExperienceStore(s => s.activeId);
  const scene = experience(activeSpace);
  const showFraneLegend = useAppStore(s => s.layers.v2Bodies || s.layers.v2Diffuse || s.layers.iffi);
  const drawerOpen = useAppStore((s) => s.drawerOpen);
  const drawingMode = useAppStore((s) => s.drawingMode);
  const mapControlsRoot = useRef<HTMLDivElement>(null);
  useControlClearance(mapControlsRoot, drawerOpen, drawingMode);
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
      <SpaceRuntime />
      <TwinRuntime />
      <RegionalRuntime />
      <CatalogBrowser />
      <TopBar
        tabs={<><CatalogButton /><SpacesButton /></>}
        search={<SearchLocality />}
        icons={<IconButtons />}
      />
      <div
        className={styles.body}
        data-workspace="unified"
        data-space={activeSpace ?? "region"}
        data-drawer={drawerOpen && !drawingMode ? "open" : "closed"}
      >
        <div className={styles.map} ref={mapControlsRoot}>
          <Suspense fallback={<MapSkeleton />}>
            <MapView />
          </Suspense>
          {!drawingMode && <SpaceBar />}
          <div className={styles.rightStack} role="group" aria-label="Comandi mappa">
            <BasemapPanel />
            <LayersButton />
            <MapTools />
            <ExtensionsButton />
          </div>

          <div className={styles.threeD} data-map-3d><ThreeDButton /></div>
          {!drawingMode && showFraneLegend && <Legend />}
          <DrawingPanel />
        </div>
        <Drawer mobileSheet interactiveMap={!!activeSpace} label={scene?.title ?? "Sulla mappa"}>
          <SpacePanel />
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
