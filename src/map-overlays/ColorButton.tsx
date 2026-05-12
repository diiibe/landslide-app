import { useEffect, useRef, useState } from "react";
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
 * The trigger is a round button tinted with the current colour. Click
 * toggles a popover anchored below it; each palette swatch is a
 * 44 px-tall (on touch) button. Tapping a swatch calls onChange and
 * closes the popover. Click-outside / Escape also close.
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
  const wrapRef = useRef<HTMLDivElement>(null);

  // Click-outside via pointerdown (covers touch + mouse + pen — same
  // pattern used for SearchLocality and ComuneFilterPanel).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: Event) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
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

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
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
      {open && (
        <div className={styles.popover} role="dialog" aria-label={ariaLabel}>
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
        </div>
      )}
    </div>
  );
}
