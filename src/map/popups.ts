import maplibregl, { type Map as MLMap, type MapMouseEvent, type MapGeoJSONFeature } from "maplibre-gl";
import { SUSCEPT_LAYER } from "./layers/susceptibility";
import { IFFI_FILL } from "./layers/iffi";

type LayerMouseEvent = MapMouseEvent & { features?: MapGeoJSONFeature[] };

export interface CellPopupProps {
  cell_id: number | string;
  p: number;
  zone: string;
  sub_zone: string;
  iffi_hit: boolean;
}

export interface IffiPopupProps {
  id_frana: string;
  tipo_movimento: string;
  /** Human-readable description of the movement type (e.g. "Colamento
   *  rapido"). Optional — older IFFI records may not carry it. */
  nome_tipo: string;
  comune: string;
  provincia: string;
}

/**
 * Build the popup DOM programmatically. Every dynamic field flows through
 * `textContent`, so even if a feature property contains HTML markup it
 * renders as inert text rather than parsing as nodes (P2.2). Visual
 * structure mirrors the previous template so existing CSS targeting
 * `.cell-popup` keeps working.
 */
export function buildCellPopupNode(p: CellPopupProps): HTMLElement {
  const root = document.createElement("div");
  root.style.fontFamily = "var(--font-stack)";
  root.style.fontSize = "12px";
  root.style.color = "#23261F";

  const title = document.createElement("div");
  title.style.fontWeight = "700";
  title.textContent = `Cell ${p.cell_id}`;
  root.appendChild(title);

  const probLine = document.createElement("div");
  probLine.append("p = ");
  const probVal = document.createElement("b");
  probVal.textContent = Number(p.p).toFixed(3);
  probLine.appendChild(probVal);
  root.appendChild(probLine);

  const zoneLine = document.createElement("div");
  zoneLine.style.color = "#7A7A6E";
  zoneLine.textContent = `${p.zone} · ${p.sub_zone}`;
  root.appendChild(zoneLine);

  if (p.iffi_hit) {
    const hit = document.createElement("div");
    hit.style.color = "#7A1F10";
    hit.textContent = "IFFI intersected";
    root.appendChild(hit);
  }
  return root;
}

export function buildIffiPopupNode(p: IffiPopupProps): HTMLElement {
  const root = document.createElement("div");
  root.style.fontFamily = "var(--font-stack)";
  root.style.fontSize = "12px";
  root.style.color = "#23261F";
  root.style.minWidth = "180px";

  const title = document.createElement("div");
  title.style.fontWeight = "700";
  title.style.marginBottom = "2px";
  title.textContent = p.id_frana ? `Frana ${p.id_frana}` : "Frana";
  root.appendChild(title);

  // Human-readable movement-type name takes the headline slot under the
  // id (e.g. "Colamento rapido"). Fall back gracefully when the IFFI
  // record predates this column.
  if (p.nome_tipo) {
    const nome = document.createElement("div");
    nome.style.fontWeight = "600";
    nome.textContent = p.nome_tipo;
    root.appendChild(nome);
  }

  if (p.tipo_movimento) {
    const tipo = document.createElement("div");
    tipo.style.color = "#7A7A6E";
    tipo.style.fontVariant = "small-caps";
    tipo.style.letterSpacing = ".04em";
    tipo.textContent = p.tipo_movimento;
    root.appendChild(tipo);
  }

  const place = document.createElement("div");
  place.style.color = "#7A7A6E";
  place.style.marginTop = "4px";
  if (p.comune && p.provincia) {
    place.textContent = `${p.comune} (${p.provincia})`;
  } else {
    place.textContent = p.comune || p.provincia || "";
  }
  if (place.textContent) root.appendChild(place);
  return root;
}

/**
 * Bind click + hover handlers for cell + IFFI layers. Returns an unsubscribe
 * fn that removes ALL six handlers so a `style.load`-driven re-registration
 * doesn't leak (P1.1). The previous version only detached the two click
 * handlers, leaving four hover handlers bound to stale layer ids.
 */
export function registerPopups(m: MLMap): () => void {
  const onCell = (e: LayerMouseEvent) => {
    const f = e.features?.[0];
    if (!f) return;
    const props = f.properties as Partial<CellPopupProps> | null;
    if (!props) return;
    new maplibregl.Popup({ closeButton: false, offset: 8, className: "cell-popup" })
      .setLngLat(e.lngLat)
      .setDOMContent(
        buildCellPopupNode({
          cell_id: props.cell_id ?? "?",
          p: Number(props.p ?? 0),
          zone: String(props.zone ?? ""),
          sub_zone: String(props.sub_zone ?? ""),
          iffi_hit: Boolean(props.iffi_hit),
        }),
      )
      .addTo(m);
  };
  const onIffi = (e: LayerMouseEvent) => {
    const f = e.features?.[0];
    if (!f) return;
    const props = f.properties as Partial<IffiPopupProps> | null;
    if (!props) return;
    new maplibregl.Popup({
      closeButton: true,
      closeOnClick: true,
      offset: 8,
      className: "iffi-popup",
    })
      .setLngLat(e.lngLat)
      .setDOMContent(
        buildIffiPopupNode({
          id_frana: String(props.id_frana ?? ""),
          tipo_movimento: String(props.tipo_movimento ?? ""),
          nome_tipo: String(props.nome_tipo ?? ""),
          comune: String(props.comune ?? ""),
          provincia: String(props.provincia ?? ""),
        }),
      )
      .addTo(m);
  };
  const cellEnter = () => {
    m.getCanvas().style.cursor = "pointer";
  };
  const cellLeave = () => {
    m.getCanvas().style.cursor = "";
  };
  m.on("click", SUSCEPT_LAYER, onCell);
  m.on("click", IFFI_FILL, onIffi);
  m.on("mouseenter", SUSCEPT_LAYER, cellEnter);
  m.on("mouseleave", SUSCEPT_LAYER, cellLeave);
  m.on("mouseenter", IFFI_FILL, cellEnter);
  m.on("mouseleave", IFFI_FILL, cellLeave);

  return () => {
    m.off("click", SUSCEPT_LAYER, onCell);
    m.off("click", IFFI_FILL, onIffi);
    m.off("mouseenter", SUSCEPT_LAYER, cellEnter);
    m.off("mouseleave", SUSCEPT_LAYER, cellLeave);
    m.off("mouseenter", IFFI_FILL, cellEnter);
    m.off("mouseleave", IFFI_FILL, cellLeave);
  };
}
