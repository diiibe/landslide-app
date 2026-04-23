import { useLayoutEffect, useRef, useState } from "react";
import type { ModelId } from "@/app/types";
import { useAppStore } from "@/app/store";
import styles from "./Tabs.module.css";

const ORDER: ModelId[] = ["j2", "j3"];
const LABEL: Record<ModelId, string> = { j2: "J.2", j3: "J.3" };

export function Tabs() {
  const model = useAppStore((s) => s.model);
  const setModel = useAppStore((s) => s.setModel);
  const containerRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<{ x: number; w: number }>({ x: 0, w: 38 });

  useLayoutEffect(() => {
    const el = containerRef.current?.querySelector<HTMLButtonElement>(
      `[data-tab="${model}"]`,
    );
    if (!el || !containerRef.current) return;
    const parent = containerRef.current.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    setStyle({ x: rect.left - parent.left, w: rect.width });
  }, [model]);

  return (
    <div ref={containerRef} className={styles.tabs} role="tablist" aria-label="Model">
      {ORDER.map((m) => (
        <button
          key={m}
          data-tab={m}
          role="tab"
          aria-selected={model === m}
          className={styles.tab}
          onClick={() => setModel(m)}
        >
          {LABEL[m]}
        </button>
      ))}
      <span
        className={styles.indicator}
        style={{ transform: `translateX(${style.x}px)`, width: style.w }}
      />
    </div>
  );
}
