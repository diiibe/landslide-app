import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { USER_COLOR_PALETTE } from "@/app/store";
import styles from "./ColorButton.module.css";

interface Props {
  value: string;
  onChange: (hex: string) => void;
  /** Optional extra colours to merge with the user palette — e.g. the
   *  POI default palette so categories can be reset visually. */
  palette?: readonly string[];
  /** Accessible label for the trigger button. Required because the
   *  button has no visible text (just a colour swatch). */
  ariaLabel: string;
  title?: string;
  /** Size of the trigger swatch in CSS px. Defaults to 22 (compact);
   *  bump to 28/32 for rows with more breathing room. */
  size?: number;
  disabled?: boolean;
}

/**
 * Reliable colour picker built around a palette popover. Replaces
 * `input[type=color]` because iPad / iOS Safari handling of the
 * native picker is inconsistent (sometimes the dialog doesn't open,
 * sometimes the change event never fires) — a button + popover with
 * tap-friendly swatches works on every device.
 *
 * The popover is rendered via React.createPortal into document.body
 * so it escapes any ancestor `overflow: clip` / `overflow: hidden`
 * (every floating panel uses overflow:clip to keep focus rings inside
 * their rounded corners — which otherwise clips an in-DOM popover).
 *
 * Position is computed from the trigger's bounding rect on open and
 * re-computed when the window resizes. We anchor below-and-right by
 * default but flip up / left when there isn't room.
 */
export function ColorButton({
  value,
  onChange,
  palette,
  ariaLabel,
  title,
  size = 22,
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // De-dupe palette while preserving order. Include the current value
  // at the front so the user has a visual confirmation of what's
  // selected even if it's not in the preset list.
  const merged = (() => {
    const seen = new Set<string>();
    const out: string[] = [];
    const push = (c: string) => {
      const norm = c.toLowerCase();
      if (seen.has(norm)) return;
      seen.add(norm);
      out.push(c);
    };
    push(value);
    for (const c of palette ?? []) push(c);
    for (const c of USER_COLOR_PALETTE) push(c);
    return out;
  })();

  // Click-outside + Escape. Pointerdown covers touch + mouse + pen,
  // same pattern as SearchLocality. We allow events that originate
  // inside either the trigger or the popover.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: Event) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (popoverRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Recompute the popover position whenever it opens, the trigger
  // shifts (scroll), or the viewport resizes.
  useLayoutEffect(() => {
    if (!open) return;
    const compute = () => {
      const t = triggerRef.current;
      const p = popoverRef.current;
      if (!t) return;
      const r = t.getBoundingClientRect();
      const POP_W = p?.offsetWidth ?? 220;
      const POP_H = p?.offsetHeight ?? 220;
      const GAP = 6;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      // Prefer below; flip up when the popover wouldn't fit.
      const fitsBelow = r.bottom + GAP + POP_H <= vh - 8;
      const top = fitsBelow ? r.bottom + GAP : Math.max(8, r.top - GAP - POP_H);
      // Anchor left edge to the trigger, but clamp to the viewport.
      const left = Math.min(Math.max(8, r.left), vw - POP_W - 8);
      setPos({ top, left });
    };
    compute();
    window.addEventListener("resize", compute);
    window.addEventListener("scroll", compute, true);
    return () => {
      window.removeEventListener("resize", compute);
      window.removeEventListener("scroll", compute, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        style={{
          background: value,
          width: `${size}px`,
          height: `${size}px`,
        }}
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={title ?? ariaLabel}
      />
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popoverRef}
            className={styles.popover}
            role="dialog"
            aria-label={ariaLabel}
            style={pos ? { top: `${pos.top}px`, left: `${pos.left}px` } : { visibility: "hidden" }}
          >
            <div className={styles.grid}>
              {merged.map((c) => {
                const selected = c.toLowerCase() === value.toLowerCase();
                return (
                  <button
                    key={c}
                    type="button"
                    className={styles.swatch}
                    data-selected={selected}
                    style={{ background: c }}
                    aria-label={`Use ${c}`}
                    aria-pressed={selected}
                    onClick={() => {
                      onChange(c);
                      setOpen(false);
                    }}
                  />
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
