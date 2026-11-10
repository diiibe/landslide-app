import { NaturePanel } from "./nature/Panel";
import { isNatureSpace } from "./types";
import { useEffect, useRef } from "react";
import { Icon } from "@/ui/Icon";
import { RegionalPanel } from "@/regional/Panel";
import { useExperienceStore } from "./store";
import { FranePanel } from "./FranePanel";
import { Workbench } from "./tools/Workbench";
import { SpaceDataStatus } from "./SpaceDataStatus";
import { DemoPanel } from "./DemoPanel";
import styles from "./Panel.module.css";
export function SpacePanel() {
  const active = useExperienceStore((s) => s.activeId),
    tab = useExperienceStore((s) => s.tab),
    zones = useExperienceStore((s) => s.showZones),
    sensors = useExperienceStore((s) => s.showSensors),
    vehicles = useExperienceStore((s) => s.showVehicles);
  const selected = useExperienceStore((s) => s.selectedId),
    areaId = useExperienceStore((s) => s.area?.id);
  const inspectionRequest = useExperienceStore(s=>s.inspectionRequest);
  const content = useRef<HTMLDivElement>(null),
    previous = useRef({ active, selected, areaId, inspectionRequest });
  useEffect(() => {
    const changed =
      previous.current.active === active &&
      (previous.current.selected !== selected ||
        previous.current.areaId !== areaId || previous.current.inspectionRequest !== inspectionRequest);
    previous.current = { active, selected, areaId, inspectionRequest };
    if (!changed || tab !== "overview") return;
    const frame = requestAnimationFrame(() => {
      const heading = (selected ? content.current?.querySelector<HTMLElement>("[data-space-inspection]") : null) ?? content.current?.querySelector<HTMLElement>("h2");
      if (!heading) return;
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
      heading.scrollIntoView?.({ block: "start", behavior: "instant" });
    });
    return () => cancelAnimationFrame(frame);
  }, [active, selected, areaId, tab, inspectionRequest]);
  if (!active) return <RegionalPanel />;
  return (
    <div ref={content}>
      <div
        className={styles.panelTabs}
        role="tablist"
        aria-label="Pannello dello spazio"
      >
        <button
          role="tab"
          aria-selected={tab === "overview"}
          onClick={() => useExperienceStore.setState({ tab: "overview" })}
        >
          {active === "landslides" ? "Analisi" : "Esplora"}
        </button>
        <button
          role="tab"
          aria-selected={tab === "layers"}
          onClick={() => useExperienceStore.setState({ tab: "layers" })}
        >
          Livelli
        </button>
        <button role="tab" aria-selected={tab === "tools"} onClick={() => useExperienceStore.setState({ tab: "tools" })}><Icon name="extensions" />Estensioni</button>
      </div>
      {(!isNatureSpace(active) || tab === "layers") && <SpaceDataStatus />}
      {isNatureSpace(active) && tab !== "layers" ? <NaturePanel tools={tab === "tools"}/> : tab === "tools" ? <Workbench /> : tab === "overview" ? (
        active === "landslides" ? (
          <FranePanel />
        ) : (
          <DemoPanel />
        )
      ) : (
        <>
          {active !== "landslides" && !isNatureSpace(active) && (
            <div className={styles.panel}>
              <section className={styles.section}>
                <h3>Livelli dello Spazio</h3>
                <div className={styles.actions}>
                  {(
                    [
                      ["showZones", "Zone", zones],
                      ["showSensors", "Sensori", sensors],
                      ["showVehicles", "Movimento", vehicles],
                    ] as const
                  ).map(([key, label, value]) => (
                    <button
                      key={key}
                      aria-pressed={value}
                      onClick={() =>
                        useExperienceStore.setState({ [key]: !value })
                      }
                    >
                      {label} {value && <Icon name="check" />}
                    </button>
                  ))}
                </div>
                <p className={styles.caption}>
                  I livelli del catalogo sottostante sono dati reali e restano
                  distinti dalla simulazione.
                </p>
              </section>
            </div>
          )}
          <RegionalPanel />
        </>
      )}
    </div>
  );
}
