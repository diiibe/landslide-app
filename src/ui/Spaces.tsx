import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "./Icon";
import { useSpaces } from "./spacesStore";
import { SpaceHub } from "@/spaces/SpaceHub";
import { useExperienceStore } from "@/spaces/store";
import { useAppStore } from "@/app/store";
import styles from "./Spaces.module.css";
import buttons from "@/topbar/IconButtons.module.css";
function LocalDialog({ open, title, onClose, children, wide = false }: { open: boolean; title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const el = ref.current; if (open && el && !el.open) { el.showModal(); (wide ? el.querySelector<HTMLElement>('input[type="search"]') : null)?.focus(); if (!wide) el.querySelector<HTMLButtonElement>('button[aria-label="Chiudi"]')?.focus(); } else if (!open && el?.open) el.close(); }, [open, wide]);
  return <dialog ref={ref} className={`${styles.dialog} ${wide ? styles.wide : ""}`} aria-label={title} onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }} onKeyDown={e => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose(); } }}>
    <header><h1>{title}</h1><button aria-label="Chiudi" onClick={onClose}><Icon name="close" /></button></header><div className={styles.content}>{children}</div>
  </dialog>;
}
export function SpacesButton() {
  const open = useExperienceStore(s => s.hubOpen);
  return <>
    <button className={styles.trigger} aria-label="Spazi" title="Esplora gli spazi" aria-haspopup="dialog" aria-expanded={open} onClick={e => { e.currentTarget.focus({ preventScroll: true }); useExperienceStore.setState({hubOpen:true}); }}><Icon name="spaces" /><span>Spazi</span></button>
    <LocalDialog open={open} wide title="I tuoi spazi" onClose={() => useExperienceStore.setState({hubOpen:false})}><SpaceHub /></LocalDialog>
  </>;
}
export function ProfileButton() {
  const [open, setOpen] = useState(false);
  const count = useSpaces(s => s.spaces.length), layers = useAppStore(s => s.userLayers.length);
  return <>
    <button className={buttons.btn} aria-label="Profilo" title="Profilo su questo dispositivo" aria-haspopup="dialog" aria-expanded={open} onClick={e => { e.currentTarget.focus({ preventScroll: true }); setOpen(true); }}><Icon name="profile" /></button>
    <LocalDialog open={open} title="Il tuo profilo" onClose={() => setOpen(false)}><div className={styles.profile}><Icon name="profile" /><strong>Questo dispositivo</strong></div><p>Stai usando FriulView senza un account collegato. Spazi e file personali sono salvati nel browser, senza sincronizzazione tra dispositivi.</p><dl className={styles.stats}><div><dt>Spazi salvati</dt><dd>{count}</dd></div><div><dt>File personali</dt><dd>{layers}</dd></div></dl><p className={styles.note}>Per portare i tuoi file su un altro dispositivo, usa Strumenti → Esporta.</p></LocalDialog>
  </>;
}
