import { isNatureSpace } from "./types";
import { natureLabel } from "./nature/experiences";
import { Icon } from "@/ui/Icon";
import { useAppStore } from "@/app/store";
import { experience } from "./experiences";
import { leaveExperience, useExperienceStore } from "./store";
import { useSpaceClock } from "./useClock";
import styles from "./Panel.module.css";
export function SpaceBar() {
  const id = useExperienceStore((s) => s.activeId),
    replay = useExperienceStore((s) => s.replayTime),
    time = useSpaceClock();
  const scene = experience(id);
  if (!scene) return null;
  return (
    <div
      className={styles.spaceBar}
      style={{ "--space-tone": scene.tone } as React.CSSProperties}
    >
      <button
        className={styles.back}
        aria-label="Torna al territorio"
        title="Torna al territorio"
        onClick={() => {
          document
            .querySelector<HTMLButtonElement>('button[aria-label="Spazi"]')
            ?.focus();
          leaveExperience();
        }}
      >
        <Icon name="arrow" />
      </button>
      <button
        className={styles.spaceIdentity}
        onClick={() => {
          useExperienceStore.setState({ tab: "overview" });
          useAppStore.setState({ drawerOpen: true });
        }}
        aria-label={`Apri scheda · ${scene.title}`}
      >
        <Icon name={scene.icon} />
        <span>
          <strong>{scene.title}</strong>
          <small>
            {id === "landslides"
              ? "Mappe reali · analisi delle zone"
              : isNatureSpace(id) ? natureLabel(id) : `${replay === null ? "Demo · ora simulata" : "Demo · replay"} ${new Date(time).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" })}`}
          </small>
        </span>
        <Icon name="chevron" />
      </button>
    </div>
  );
}
