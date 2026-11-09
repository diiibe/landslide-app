import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "./Icon";
import { saveSpace, restoreSpace, removeSpace, useSpaces } from "./spacesStore";
import { useAppStore } from "@/app/store";
import styles from "./Spaces.module.css";
import buttons from "@/topbar/IconButtons.module.css";
function LocalDialog({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const el = ref.current; if (open && el && !el.open) { el.showModal(); el.querySelector<HTMLButtonElement>('button[aria-label="Chiudi"]')?.focus(); } else if (!open && el?.open) el.close(); }, [open]);
  return <dialog ref={ref} className={styles.dialog} aria-label={title} onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }} onKeyDown={e => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose(); } }}>
    <header><h1>{title}</h1><button aria-label="Chiudi" onClick={onClose}><Icon name="close" /></button></header><div className={styles.content}>{children}</div>
  </dialog>;
}
export function SpacesButton() {
  const [open, setOpen] = useState(false), [name, setName] = useState(""), [error, setError] = useState("");
  const { spaces, storageError } = useSpaces();
  return <>
    <button className={styles.trigger} aria-label="Spazi" title="Le tue viste salvate" aria-haspopup="dialog" aria-expanded={open} onClick={e => { e.currentTarget.focus({ preventScroll: true }); setOpen(true); }}><Icon name="spaces" /><span>Spazi</span></button>
    <LocalDialog open={open} title="I tuoi spazi" onClose={() => setOpen(false)}>
      <p>Salva i livelli del catalogo, lo sfondo e l’inquadratura. I dati di ogni spazio continuano ad aggiornarsi.</p>
      <form className={styles.form} onSubmit={e => { e.preventDefault(); try { saveSpace(name.trim()); setName(""); setError(""); } catch { setError("Non è stato possibile salvare questa vista. Riprova."); } }}>
        <label>Nome dello spazio<input maxLength={70} required value={name} onChange={e => setName(e.target.value)} placeholder="Es. Costa e qualità dell’acqua" /></label><button type="submit" disabled={!name.trim() || spaces.length >= 30}><Icon name="plus" />Salva vista</button>
      </form>
      {error && <p role="alert">{error}</p>}
      {storageError && <p role="alert">Il browser non consente il salvataggio: le modifiche restano disponibili solo in questa sessione.</p>}
      {spaces.length === 30 && <p role="status">Hai raggiunto il limite di 30 spazi. Rimuovine uno per salvare una nuova vista.</p>}
      {!spaces.length && <div className={styles.empty}><Icon name="spaces" /><strong>La tua prima vista, pronta da ritrovare</strong><p>Scegli i dati sulla mappa, poi assegna un nome qui.</p></div>}
      <div className={styles.list}>{spaces.map(s => <article key={s.id}><button className={styles.restore} onClick={() => { restoreSpace(s); setOpen(false); }}><Icon name="spaces" /><span><strong>{s.name}</strong><small>{Object.values(s.layers).filter(Boolean).length + Object.values(s.enabled).filter(Boolean).length} livelli · {new Date(s.savedAt).toLocaleDateString("it-IT")}</small></span><Icon name="arrow" /></button><button aria-label={`Elimina spazio · ${s.name}`} onClick={() => removeSpace(s.id)}><Icon name="close" /></button></article>)}</div>
      <p className={styles.note}>Su questo dispositivo · fino a 30 spazi. I file personali restano gestiti nella mappa; usa Esporta per conservarne una copia.</p>
    </LocalDialog>
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
