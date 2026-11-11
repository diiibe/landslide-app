import { useEffect, useState } from "react";
import styles from "./TopBar.module.css";
const date = new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Rome" });
const hour = new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" });
/** Wall clock, independent from the observation/replay time of a Space. */
export function BrandClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const current = new Date();
      setNow(current);
      timer = setTimeout(tick, 60_000 - current.getTime() % 60_000);
    };
    const visible = () => {
      clearTimeout(timer);
      if (!document.hidden) tick();
    };
    visible();
    document.addEventListener("visibilitychange", visible);
    return () => { clearTimeout(timer); document.removeEventListener("visibilitychange", visible); };
  }, []);
  return <time data-ui-part="clock" className={styles.clock} dateTime={now.toISOString()} title="Data e ora attuali · Europe/Rome" aria-label={`${date.format(now)}, ore ${hour.format(now)}, ora italiana`}><span className={styles.clockDateFull}>{date.format(now)}</span><span className={styles.clockDateShort}>{date.format(now).slice(0,5)}</span><span>{hour.format(now)}</span></time>;
}
