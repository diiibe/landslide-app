import { useRef } from "react";
import { Icon } from "./Icon";
import styles from "./SearchField.module.css";
interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}
export function SearchField({
  label,
  value,
  onChange,
  placeholder = "Nome, parametro, fonte…",
}: Props) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className={styles.field}>
      <Icon name="search" />
      <input
        ref={input}
        type="search"
        aria-label={label}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button
          type="button"
          aria-label={"Svuota · " + label}
          onClick={() => {
            onChange("");
            input.current?.focus();
          }}
        >
          <Icon name="close" />
        </button>
      )}
    </div>
  );
}
