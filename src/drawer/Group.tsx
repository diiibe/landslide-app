import type { ReactNode } from "react";
import { useAppStore } from "@/app/store";
import type { GroupId } from "@/app/store";
import styles from "./Group.module.css";

interface Props {
  id: GroupId;
  label: string;
  children: ReactNode;
}

export function Group({ id, label, children }: Props) {
  const open = useAppStore((s) => s.groupOpen[id]);
  const toggle = useAppStore((s) => s.toggleGroup);
  return (
    <div className={styles.group} data-open={open}>
      <button
        type="button"
        className={styles.head}
        aria-expanded={open}
        onClick={() => toggle(id)}
      >
        {label}
        <span className={styles.caret} aria-hidden="true">▾</span>
      </button>
      <div className={styles.wrap}>
        <div className={styles.body}>{children}</div>
      </div>
    </div>
  );
}
