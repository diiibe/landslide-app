import { LandslideClassPicker } from "@/ui/LandslideClassPicker";
import { selectedClasses, withClasses } from "@/lib/landslideClasses";
import { Select } from "@/ui/Select";
import { FVG_BOUNDS } from "@/map/style";
import { ColorButton } from "@/map-overlays/ColorButton";
import { PoiLegendPanel } from "@/map-overlays/PoiLegendPanel";
import { useAppStore } from "@/app/store";
import { useModelV2 } from "@/lib/modelV2";
import { ModelV2Panel } from "@/drawer/ModelV2Panel";
import type { CatalogItem } from "./catalog";
import styles from "./Panel.module.css";
export function MapLayerControls({ item }: { item: CatalogItem }) {
  const s = useAppStore(),
    model = useModelV2();
  const key = item.mapKey;
  const which =
    key === "v2Bodies" ? "bodies" : key === "v2Diffuse" ? "diffuse" : null;
  const settings = which ? s.susceptibilityStyle[which] : null;
  const n =
    which && model.status === "ready" ? model.data.layers[which].classes : 5;
  return (
    <div className={styles.toolbar}>
      <p>{item.layer.description}</p>
      {settings && which && (
        <>
          <LandslideClassPicker value={selectedClasses(settings, n)} count={n}
            onChange={classes => useAppStore.setState(v => ({ susceptibilityStyle: {
              ...v.susceptibilityStyle, [which]: withClasses(v.susceptibilityStyle[which], classes),
            } }))}/>
          <label className={styles.field}>
            Opacità · {Math.round(settings.opacity * 100)}%
            <input
              aria-label={"Opacità · " + item.layer.title}
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settings.opacity}
              onChange={(e) =>
                useAppStore.setState((v) => ({
                  susceptibilityStyle: {
                    ...v.susceptibilityStyle,
                    [which]: {
                      ...v.susceptibilityStyle[which],
                      opacity: Number(e.target.value),
                    },
                  },
                }))
              }
            />
          </label>
          <p className={styles.caption}>
            Classi per quantili del modello. Il punteggio misura la somiglianza
            con l’inventario; non è una previsione né una probabilità di frana.
          </p>
          {model.status === "missing" && (
            <p role="alert">Metadati della mappatura non disponibili.</p>
          )}
          <details>
            <summary>Metodo e validazione</summary>
            <ModelV2Panel />
          </details>
        </>
      )}
      {key === "flood" && (
        <label className={styles.field}>
          Pericolosità visualizzata
          <Select
            label="Pericolosità visualizzata"
            value={s.floodView}
            onChange={(value) => s.setFloodView(value as typeof s.floodView)}
            options={[
              { value: "combined", label: "Tutte le classi" },
              { value: "P1plus", label: "P1 · sola classe bassa" },
              { value: "P2plus", label: "P2 · sola classe media" },
              { value: "P3", label: "P3 · classe elevata" },
            ]}
          />
        </label>
      )}
      {(key === "flood" || key === "pai" || key === "diff") && (
        <label className={styles.field}>
          Opacità
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={
              key === "flood"
                ? s.floodOpacity
                : key === "pai"
                  ? s.paiOpacity
                  : s.diffOpacity
            }
            onChange={(e) =>
              (key === "flood"
                ? s.setFloodOpacity
                : key === "pai"
                  ? s.setPaiOpacity
                  : s.setDiffOpacity)(Number(e.target.value))
            }
          />
        </label>
      )}
      {(key === "poiCritical" || key === "poiHuts") && <PoiLegendPanel />}
      {(item.layer.bounds ||
        item.mapKey?.startsWith("v2") ||
        key === "iffi") && (
        <button
          onClick={() => {
            window.dispatchEvent(
              new CustomEvent("fvg:regional-fit", {
                detail: item.layer.bounds ?? FVG_BOUNDS,
              }),
            );
            if (
              window.matchMedia(
                "(max-width: 768px), (max-height: 500px) and (pointer: coarse)",
              ).matches
            )
              useAppStore.setState({ drawerOpen: false });
          }}
        >
          Inquadra il livello
        </button>
      )}
      {item.userId && (
        <>
          <label className={styles.checks}>
            Colore del livello
            <ColorButton
              value={
                s.userLayers.find((u) => u.id === item.userId)?.color ??
                item.layer.color
              }
              ariaLabel="Colore del file"
              size={32}
              onChange={(color) =>
                s.updateUserLayer(item.userId!, { color, colorMode: "solid" })
              }
            />
          </label>
          {s.userLayers.find((u) => u.id === item.userId)?.colorMode ===
            "riskHeatmap" && (
            <>
              <p className={styles.caption}>
                Questo file conserva una colorazione del modello precedente,
                indipendente dalle nuove mappature.
              </p>
              <button
                onClick={() =>
                  s.updateUserLayer(item.userId!, { colorMode: "solid" })
                }
              >
                Usa colore uniforme
              </button>
            </>
          )}
          <button onClick={() => s.removeUserLayer(item.userId!)}>
            Elimina il file dalla mappa
          </button>
        </>
      )}
    </div>
  );
}
