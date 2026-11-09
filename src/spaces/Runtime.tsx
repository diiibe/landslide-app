import { useEffect } from "react";
import { experience } from "./experiences";
import { openExperience, savedArea, useExperienceStore } from "./store";
export function SpaceRuntime() {
  const active = useExperienceStore((s) => s.activeId),
    playing = useExperienceStore((s) => s.playback);
  useEffect(() => {
    if (!active || active === "landslides" || !playing) return;
    const tick = setInterval(() => {
      if (document.visibilityState === "hidden") return;
      const s = useExperienceStore.getState();
      if (s.replayTime === null) return;
      const next = s.replayTime + 60000;
      if (next >= Date.now())
        useExperienceStore.setState({ replayTime: null, playback: false });
      else useExperienceStore.setState({ replayTime: next });
    }, 1000);
    return () => clearInterval(tick);
  }, [active, playing]);
  useEffect(() => {
    const requested = new URL(window.location.href).searchParams.get("space");
    const scene = experience(requested);
    if (scene) openExperience(scene.id);
    const area = (e: Event) => {
      if (useExperienceStore.getState().activeId !== "landslides") return;
      e.preventDefault();
      savedArea((e as CustomEvent<{ id: string }>).detail.id);
    };
    window.addEventListener("friulview:area", area);
    return () => window.removeEventListener("friulview:area", area);
  }, []);
  return null;
}
