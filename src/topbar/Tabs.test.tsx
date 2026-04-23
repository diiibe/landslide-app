import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { useAppStore } from "@/app/store";
import { Tabs } from "./Tabs";

describe("Tabs", () => {
  beforeEach(() => useAppStore.getState().reset());

  it("renders J.2 and J.3 and highlights the active one", () => {
    render(<Tabs />);
    const j2 = screen.getByRole("tab", { name: /J\.2/ });
    const j3 = screen.getByRole("tab", { name: /J\.3/ });
    expect(j2.getAttribute("aria-selected")).toBe("true");
    expect(j3.getAttribute("aria-selected")).toBe("false");
  });

  it("switches active model on click", () => {
    render(<Tabs />);
    fireEvent.click(screen.getByRole("tab", { name: /J\.3/ }));
    expect(useAppStore.getState().model).toBe("j3");
  });
});
