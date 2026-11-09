import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { Select, type SelectOption } from "./Select";
const entries: SelectOption[] = [
  { value: "all", label: "Tutte le classi" },
  { value: "low", label: "Classe bassa" },
  { value: "medium", label: "Classe media", disabled: true },
  { value: "high", label: "Classe elevata" },
];
function Example({ options = entries }: { options?: SelectOption[] }) {
  const [value, setValue] = useState("all");
  return (
    <>
      <Select
        label="Classe"
        value={value}
        options={options}
        onChange={setValue}
      />
      <button>Successivo</button>
    </>
  );
}
beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe("In-app Select", () => {
  it("selects with keyboard, skips disabled options, and restores the trigger without bubbling Escape", () => {
    const escape = vi.fn();
    render(
      <div onKeyDown={escape}>
        <Example />
      </div>,
    );
    const trigger = screen.getByRole("combobox", { name: "Classe" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    const list = screen.getByRole("listbox", { name: "Classe" });
    expect(list).toHaveFocus();
    fireEvent.keyDown(list, { key: "End" });
    fireEvent.keyDown(list, { key: "Enter" });
    expect(trigger).toHaveTextContent("Classe elevata");
    expect(trigger).toHaveFocus();
    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "ArrowUp" });
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "Enter" });
    expect(trigger).toHaveTextContent("Classe bassa");
    fireEvent.click(trigger);
    escape.mockClear();
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "Escape" });
    expect(escape).not.toHaveBeenCalled();
    expect(trigger).toHaveFocus();
    expect(screen.queryByRole("listbox")).toBeNull();
  });
  it("filters long lists, selects a result and treats an empty search result safely", () => {
    render(
      <Example
        options={[
          ...entries,
          ...Array.from({ length: 8 }, (_, i) => ({
            value: String(i),
            label: `Stazione ${i}`,
          })),
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("combobox"));
    const search = screen.getByRole("searchbox", { name: "Cerca · Classe" });
    expect(search).toHaveFocus();
    fireEvent.change(search, { target: { value: "stazione 4" } });
    fireEvent.keyDown(search, { key: "ArrowDown" });
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "Enter" });
    expect(screen.getByRole("combobox")).toHaveTextContent("Stazione 4");
    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "assente" },
    });
    expect(screen.queryByRole("option")).toBeNull();
    fireEvent.keyDown(screen.getByRole("searchbox"), { key: "ArrowDown" });
    fireEvent.keyDown(screen.getByRole("searchbox"), { key: "Enter" });
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });
  it("dismisses outside and continues Tab from the trigger rather than from the portal", () => {
    vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([
      new DOMRect(0, 0, 100, 44),
    ] as unknown as DOMRectList);
    render(<Example />);
    const trigger = screen.getByRole("combobox");
    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "Tab" });
    expect(screen.getByRole("button", { name: "Successivo" })).toHaveFocus();
    fireEvent.click(trigger);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Successivo" }));
    expect(screen.queryByRole("listbox")).toBeNull();
  });
  it("keeps the popup inside its enclosing modal dialog", () => {
    const { container } = render(
      <dialog open>
        <Example />
      </dialog>,
    );
    fireEvent.click(screen.getByRole("combobox"));
    expect(
      container.querySelector("dialog")!.contains(screen.getByRole("listbox")),
    ).toBe(true);
  });
  it("updates the selected label when live options change without inventing a different value", () => {
    const { rerender } = render(
      <Select
        label="Live"
        value="a"
        options={[{ value: "a", label: "A · 2" }]}
        onChange={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("combobox"));
    act(() =>
      rerender(
        <Select
          label="Live"
          value="a"
          options={[{ value: "a", label: "A · 3" }]}
          onChange={() => {}}
        />,
      ),
    );
    expect(screen.getByRole("combobox")).toHaveTextContent("A · 3");
    expect(screen.getByRole("option", { selected: true })).toHaveTextContent(
      "A · 3",
    );
  });
  it("keeps search editable while using arrow keys and while a live list shrinks", () => {
    const many = Array.from({ length: 10 }, (_, i) => ({
      value: String(i),
      label: `Stazione ${i}`,
    }));
    const { rerender } = render(<Example options={many} />);
    fireEvent.click(screen.getByRole("combobox"));
    const search = screen.getByRole("searchbox");
    fireEvent.change(search, { target: { value: "Stazione 9" } });
    fireEvent.keyDown(search, { key: "ArrowDown" });
    expect(search).toHaveFocus();
    rerender(<Example options={many.slice(0, 7)} />);
    expect(screen.getByRole("searchbox")).toHaveValue("Stazione 9");
    fireEvent.change(search, { target: { value: "Stazione 2" } });
    fireEvent.keyDown(search, { key: "Enter" });
    expect(screen.getByRole("combobox")).toHaveTextContent("Stazione 2");
  });
  it("includes native disclosure summaries in the Tab sequence", () => {
    vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([
      new DOMRect(0, 0, 100, 44),
    ] as unknown as DOMRectList);
    render(
      <>
        <Select
          label="Classe"
          value="all"
          options={entries}
          onChange={() => {}}
        />
        <input type="hidden" />
        <details>
          <summary>Fonte</summary>
        </details>
        <button>After</button>
      </>,
    );
    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "Tab" });
    expect(screen.getByText("Fonte", { exact: true })).toHaveFocus();
  });
});
