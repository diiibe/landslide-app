import { useEffect, useRef, useState } from "react";
import { Icon } from "@/ui/Icon";
import { UploadButton } from "@/topbar/UploadButton";
import { DrawButton } from "@/topbar/DrawButton";
import { ExportImportButton } from "@/topbar/ExportImportButton";
import styles from "./MapTools.module.css";
export function MapTools() {
  const [open, setOpen] = useState(false), ref = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node) && !(e.target as Element).closest('dialog, [role="dialog"]')) setOpen(false); };
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape" && ref.current?.contains(e.target as Node)) { e.preventDefault(); e.stopPropagation(); setOpen(false); trigger.current?.focus(); } };
    document.addEventListener("pointerdown", outside);
    ref.current?.addEventListener("keydown", escape);
    const el = ref.current;
    return () => { document.removeEventListener("pointerdown", outside); el?.removeEventListener("keydown", escape); };
  }, [open]);
  return <div className={styles.panel} ref={ref}>
    <button ref={trigger} className={styles.head} aria-expanded={open} aria-controls="map-tools" onClick={() => setOpen(!open)}><Icon name="tools" /><span>Strumenti</span><Icon name="chevron" /></button>
    <div id="map-tools" hidden={!open} className={styles.body} onClick={e => { if ((e.target as Element).closest('button[data-close-tools]')) { setOpen(false); trigger.current?.focus({ preventScroll: true }); } }}>
      <UploadButton labeled /><DrawButton labeled /><ExportImportButton labeled />
      <p>GPX, GeoJSON, KML e aree disegnate</p>
    </div>
  </div>;
}
