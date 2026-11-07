import { describe, expect, it } from "vitest";
import { buildCellPopupNode, buildIffiPopupNode, buildV2PopupNode } from "./popups";

/**
 * P2.2: feature properties used to be interpolated into a template literal
 * and handed to `Popup.setHTML`. If a malicious tile somehow shipped a
 * string like "<script>alert(1)</script>" in `comune` or any other field,
 * it would parse as live HTML inside the popup. Build the DOM
 * programmatically with `textContent` instead so untrusted strings render
 * as text.
 */
describe("buildCellPopupNode", () => {
  it("renders zone/sub_zone strings as text, not HTML", () => {
    const node = buildCellPopupNode({
      cell_id: 42,
      p: 0.731,
      zone: "<script>alert(1)</script>",
      sub_zone: "<img src=x onerror=alert(2)>",
      iffi_hit: false,
    });
    // The dangerous tags must appear as literal text, never as DOM nodes.
    expect(node.querySelector("script")).toBeNull();
    expect(node.querySelector("img")).toBeNull();
    const text = node.textContent ?? "";
    expect(text).toContain("<script>alert(1)</script>");
    expect(text).toContain("<img src=x onerror=alert(2)>");
  });

  it("formats probability and shows IFFI flag when present", () => {
    const node = buildCellPopupNode({
      cell_id: 7,
      p: 0.5,
      zone: "Alpine",
      sub_zone: "Steep_Mountain",
      iffi_hit: true,
    });
    const text = node.textContent ?? "";
    expect(text).toContain("Cell 7");
    expect(text).toContain("0.500");
    expect(text).toContain("Alpine");
    expect(text).toContain("IFFI");
  });
});

describe("buildIffiPopupNode", () => {
  it("renders comune/provincia as text even with HTML payload", () => {
    const node = buildIffiPopupNode({
      id_frana: "F-001",
      tipo_movimento: "frana di crollo",
      nome_tipo: "Crollo / ribaltamento",
      comune: "<script>alert('xss')</script>",
      provincia: "<b>UD</b>",
    });
    expect(node.querySelector("script")).toBeNull();
    expect(node.querySelector("b")).toBeNull();
    const text = node.textContent ?? "";
    expect(text).toContain("F-001");
    expect(text).toContain("<script>alert('xss')</script>");
    expect(text).toContain("<b>UD</b>");
  });
});

describe("buildV2PopupNode", () => {
  it("names the layer, the class and explains a holdout source", () => {
    const node = buildV2PopupNode({ layer: "bodies", cls: 4, ncls: 5, source: "holdout" });
    const text = node.textContent ?? "";
    expect(text).toContain("corpi di frana");
    expect(text).toContain("Classe 4 di 5");
    expect(text).toMatch(/mai visto quest'area/);
    expect(node.querySelector(".fvg-popup__warn")).toBeNull();
  });

  it("flags in-sample cells", () => {
    const node = buildV2PopupNode({ layer: "diffuse", cls: 2, ncls: 4, source: "in_sample" });
    expect(node.textContent).toContain("zone diffuse");
    expect(node.textContent).toContain("Classe 2 di 4"); // collapsed classes
    const warn = node.querySelector(".fvg-popup__warn");
    expect(warn?.textContent).toMatch(/in-sample/i);
  });

  it("never claims a landslide will happen", () => {
    const node = buildV2PopupNode({ layer: "bodies", cls: 5, ncls: 5, source: "oof" });
    expect(node.textContent).toMatch(/non è una previsione/);
  });

  it("renders an unknown source string as text, not HTML", () => {
    const node = buildV2PopupNode({ layer: "bodies", cls: 1, ncls: 5, source: "<img src=x>" });
    expect(node.querySelector("img")).toBeNull();
    expect(node.textContent).toContain("<img src=x>");
  });
});
