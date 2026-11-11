import {
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";
import styles from "./Select.module.css";

export interface SelectOption {
  value: string;
  label: string;
  group?: string;
  disabled?: boolean;
}
interface Props {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  describedBy?: string;
  disabled?: boolean;
}
const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("it");

/** A styled, keyboard-operable listbox; never opens the operating-system picker. */
export function Select({
  label,
  value,
  options,
  onChange,
  describedBy,
  disabled,
}: Props) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null),
    menu = useRef<HTMLDivElement>(null),
    list = useRef<HTMLDivElement>(null),
    search = useRef<HTMLInputElement>(null);
  const typeahead = useRef({ text: "", time: 0 });
  const [parent, setParent] = useState<HTMLElement | null>(null);
  const [uiScope, setUiScope] = useState<string | undefined>(undefined);
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(""),
    [active, setActive] = useState<string | null>(value),
    [searchable, setSearchable] = useState(false);
  const visible = useMemo(
    () =>
      options.filter((o) =>
        normalize(o.label + " " + (o.group ?? "")).includes(normalize(query)),
      ),
    [options, query],
  );
  const enabled = visible.filter((o) => !o.disabled);
  const selected = options.find((o) => o.value === value);
  const activeOption = enabled.find((o) => o.value === active) ?? enabled[0];
  const optionId = (option: SelectOption) =>
    `${id}-option-${options.indexOf(option)}`;
  const close = (restore = true) => {
    setOpen(false);
    if (restore) trigger.current?.focus({ preventScroll: true });
  };
  const choose = (option: SelectOption) => {
    if (option.disabled) return;
    onChange(option.value);
    close();
  };
  const show = () => {
    if (disabled) return;
    trigger.current?.focus({ preventScroll: true });
    setParent(trigger.current?.closest("dialog[open]") ?? document.body);
    setUiScope(trigger.current?.closest<HTMLElement>("[data-ui]")?.dataset.ui);
    setQuery("");
    setSearchable(options.length > 7);
    setActive(value);
    setOpen(true);
  };

  useLayoutEffect(() => {
    if (!open || !menu.current || !trigger.current) return;
    const popup = menu.current,
      button = trigger.current;
    // Popover promotes only our HTML to the top layer. It has no native menu UI.
    // Its DOM parent remains the enclosing dialog, so modal inertness is preserved.
    const promoted = typeof popup.showPopover === "function";
    if (promoted) {
      popup.setAttribute("popover", "manual");
      popup.showPopover();
    }
    const position = () => {
      const rect = button.getBoundingClientRect(),
        vv = window.visualViewport;
      const leftEdge = vv?.offsetLeft ?? 0,
        topEdge = vv?.offsetTop ?? 0;
      const viewportWidth = vv?.width ?? innerWidth,
        viewportHeight = vv?.height ?? innerHeight;
      const width = Math.min(Math.max(rect.width, 260), viewportWidth - 24);
      const below = topEdge + viewportHeight - rect.bottom - 16,
        above = rect.top - topEdge - 16;
      const upwards = below < 210 && above > below;
      const maxHeight = Math.max(
        0,
        Math.min(360, viewportHeight - 24, upwards ? above : below),
      );
      popup.style.width = `${width}px`;
      popup.style.maxHeight = `${maxHeight}px`;
      popup.style.left = `${Math.max(leftEdge + 12, Math.min(rect.left, leftEdge + viewportWidth - width - 12))}px`;
      const height = popup.getBoundingClientRect().height;
      const preferredTop = upwards ? rect.top - height - 6 : rect.bottom + 6;
      popup.style.top = `${Math.max(topEdge + 12, Math.min(preferredTop, topEdge + viewportHeight - height - 12))}px`;
    };
    position();
    (searchable ? search.current : list.current)?.focus({
      preventScroll: true,
    });
    position();
    const outside = (event: PointerEvent) => {
      if (
        !popup.contains(event.target as Node) &&
        !button.contains(event.target as Node)
      )
        setOpen(false);
    };
    const scroll = (event: Event) => {
      if (!popup.contains(event.target as Node)) position();
    };
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("scroll", scroll, true);
    window.addEventListener("resize", position);
    window.visualViewport?.addEventListener("resize", position);
    window.visualViewport?.addEventListener("scroll", position);
    const observer = new ResizeObserver(position);
    observer.observe(button);
    observer.observe(popup);
    return () => {
      if (promoted && popup.matches(":popover-open")) popup.hidePopover();
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("scroll", scroll, true);
      window.removeEventListener("resize", position);
      window.visualViewport?.removeEventListener("resize", position);
      window.visualViewport?.removeEventListener("scroll", position);
      observer.disconnect();
    };
  }, [open, searchable]);
  useLayoutEffect(() => {
    if (open && activeOption)
      document
        .getElementById(`${id}-option-${options.indexOf(activeOption)}`)
        ?.scrollIntoView?.({ block: "nearest" });
    // The identifier and label can change when an automatically refreshed list changes.
  }, [open, activeOption, id, options]);

  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      event.stopPropagation();
      const scope = trigger.current?.closest("dialog[open]") ?? document;
      const controls = [
        ...scope.querySelectorAll<HTMLElement>(
          'button, input:not([type="hidden"]), textarea, select, summary, a[href], [tabindex]',
        ),
      ].filter(
        (el) =>
          el.tabIndex >= 0 &&
          !el.matches(":disabled") &&
          el.getClientRects().length &&
          getComputedStyle(el).visibility !== "hidden" &&
          !el.closest("[inert]") &&
          !menu.current?.contains(el),
      );
      controls.sort(
        (a, b) =>
          (a.tabIndex > 0 ? a.tabIndex : Infinity) -
          (b.tabIndex > 0 ? b.tabIndex : Infinity),
      );
      const index = controls.indexOf(trigger.current!);
      const next = controls[index + (event.shiftKey ? -1 : 1)];
      close(false);
      (next ?? trigger.current)?.focus();
      return;
    }
    const index = activeOption ? enabled.indexOf(activeOption) : -1;
    let next: SelectOption | undefined;
    if (event.key === "ArrowDown")
      next =
        event.target === search.current && active === null
          ? enabled[0]
          : enabled[(index + 1) % enabled.length];
    else if (event.key === "ArrowUp")
      next =
        event.target === search.current && active === null
          ? enabled.at(-1)
          : enabled[(index - 1 + enabled.length) % enabled.length];
    else if (event.key === "Home" && event.target !== search.current)
      next = enabled[0];
    else if (event.key === "End" && event.target !== search.current)
      next = enabled.at(-1);
    else if (
      event.key === "Enter" ||
      (event.key === " " && event.target !== search.current)
    ) {
      event.preventDefault();
      if (activeOption) choose(activeOption);
      return;
    } else if (
      !searchable &&
      event.key.length === 1 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      const now = event.timeStamp;
      typeahead.current = {
        text:
          now - typeahead.current.time < 700
            ? typeahead.current.text + event.key
            : event.key,
        time: now,
      };
      next = enabled.find((o) =>
        normalize(o.label).startsWith(normalize(typeahead.current.text)),
      );
    }
    if (next) {
      event.preventDefault();
      setActive(next.value);
      if (!searchable) list.current?.focus({ preventScroll: true });
    }
  };
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={styles.trigger}
        role="combobox"
        aria-label={label}
        aria-describedby={describedBy}
        aria-controls={`${id}-list`}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => (open ? close() : show())}
        onKeyDown={(event) => {
          if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
            event.preventDefault();
            show();
          }
        }}
      >
        <span>{selected?.label ?? "Seleziona…"}</span>
        <Icon name="chevron" />
      </button>
      {open &&
        parent &&
        createPortal(
          <div ref={menu} data-ui={uiScope} className={styles.menu} onKeyDown={onKey}>
            <div className={styles.menuHead}>{label}</div>
            {searchable && (
              <div className={styles.search}>
                <Icon name="search" />
                <input
                  ref={search}
                  type="search"
                  aria-label={`Cerca · ${label}`}
                  aria-controls={`${id}-list`}
                  aria-activedescendant={
                    activeOption ? optionId(activeOption) : undefined
                  }
                  placeholder="Cerca un’opzione…"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setActive(null);
                  }}
                />
              </div>
            )}
            <div
              ref={list}
              id={`${id}-list`}
              className={styles.options}
              role="listbox"
              aria-label={label}
              aria-activedescendant={
                activeOption ? optionId(activeOption) : undefined
              }
              tabIndex={-1}
            >
              {visible.map((option, index) => (
                <div key={option.value}>
                  {option.group &&
                    option.group !== visible[index - 1]?.group && (
                      <div className={styles.group}>{option.group}</div>
                    )}
                  <div
                    id={optionId(option)}
                    role="option"
                    aria-selected={option.value === value}
                    aria-disabled={option.disabled || undefined}
                    className={styles.option}
                    data-highlight={option.value === activeOption?.value}
                    onPointerMove={() =>
                      !option.disabled && setActive(option.value)
                    }
                    onClick={() => choose(option)}
                  >
                    <span>{option.label}</span>
                    <Icon name="check" />
                  </div>
                </div>
              ))}
              {!visible.length && (
                <p className={styles.empty}>
                  Nessun risultato. Prova un altro nome.
                </p>
              )}
            </div>
          </div>,
          parent,
        )}
    </>
  );
}
