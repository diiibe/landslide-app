import { useEffect, useState } from "react";
import { useExperienceStore } from "./store";
export function useSpaceClock(wall = false) {
  const replay = useExperienceStore((s) => (wall ? null : s.replayTime)),
    active = useExperienceStore((s) => s.activeId);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!active || active === "landslides" || replay !== null) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const sync = () => {
      if (timer) clearInterval(timer);
      if (document.visibilityState === "hidden") return;
      setNow(Date.now());
      timer = setInterval(() => setNow(Date.now()), 1000);
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("focus", sync);
    return () => {
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("focus", sync);
    };
  }, [active, replay]);
  return replay ?? now;
}
