import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "@/ui/Icon";
import css from "./Air.module.css";
export function AirDialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (open && !el?.open) {
      el?.showModal();
      el?.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true });
    } else if (!open && el?.open) el.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      data-ui="local-dialog"
      className={css.dialog}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
    >
      <header>
        <h2 tabIndex={-1}>{title}</h2>
        <button aria-label="Chiudi" onClick={onClose}>
          <Icon name="close" />
        </button>
      </header>
      {children}
    </dialog>
  );
}
