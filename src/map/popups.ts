import maplibregl, { type Map as MLMap, type MapMouseEvent } from "maplibre-gl";
import { SUSCEPT_LAYER } from "./layers/susceptibility";
import { IFFI_FILL } from "./layers/iffi";

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
  root.className = "fvg-popup";

  const title = document.createElement("div");
  title.className = "fvg-popup__title";
  title.textContent = `Cell ${p.cell_id}`;
  root.appendChild(title);

  const probLine = document.createElement("div");
  probLine.append("p = ");
  const probVal = document.createElement("b");
  probVal.textContent = Number(p.p).toFixed(3);
  probLine.appendChild(probVal);
  root.appendChild(probLine);

  const zoneLine = document.createElement("div");
  zoneLine.className = "fvg-popup__muted";
  zoneLine.textContent = `${p.zone} · ${p.sub_zone}`;
  root.appendChild(zoneLine);

  if (p.iffi_hit) {
    const hit = document.createElement("div");
    hit.className = "fvg-popup__warn";
    hit.textContent = "IFFI intersected";
    root.appendChild(hit);
  }
  return root;
}

export function buildIffiPopupNode(p: IffiPopupProps): HTMLElement {
  const root = document.createElement("div");
  root.className = "fvg-popup";
  root.style.minWidth = "180px";

  const title = document.createElement("div");
  title.className = "fvg-popup__title";
  title.textContent = p.id_frana ? `Frana ${p.id_frana}` : "Frana";
  root.appendChild(title);

  // Human-readable movement-type name takes the headline slot under the
  // id (e.g. "Colamento rapido"). Fall back gracefully when the IFFI
  // record predates this column.
  if (p.nome_tipo) {
    const nome = document.createElement("div");
    nome.className = "fvg-popup__strong";
    nome.textContent = p.nome_tipo;
    root.appendChild(nome);
  }

  if (p.tipo_movimento) {
    const tipo = document.createElement("div");
    tipo.className = "fvg-popup__caps";
    tipo.textContent = p.tipo_movimento;
    root.appendChild(tipo);
  }

  const place = document.createElement("div");
  place.className = "fvg-popup__muted";
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
 * Build a single combined popup node when the click lands on both a
 * susceptibility cell and an IFFI polygon at the same point. The two
 * sections sit one above the other inside one card; a thin divider
 * marks the boundary. Either argument may be `null` (just one feature
 * was hit); the resulting node renders only the relevant section.
 */
function buildCombinedNode(
  cell: CellPopupProps | null,
  iffi: IffiPopupProps | null,
): HTMLElement {
  const root = document.createElement("div");
  root.className = "fvg-popup fvg-popup--stack";
  if (cell) root.appendChild(buildCellPopupNode(cell));
  if (cell && iffi) {
    const sep = document.createElement("div");
    sep.className = "fvg-popup__divider";
    root.appendChild(sep);
  }
  if (iffi) root.appendChild(buildIffiPopupNode(iffi));
  return root;
}

/**
 * Single map-scoped click handler that queries the cell + IFFI layers
 * at the click point and renders ONE combined popup. Previously the
 * two layer-scoped handlers each created their own popup, so clicking
 * on a cell inside an IFFI polygon produced overlapping cards.
 * Hover is still per-layer so the cursor only changes over actually
 * interactive geometry.
 */
export function registerPopups(m: MLMap): () => void {
  const onClick = (e: MapMouseEvent) => {
    const layers = [SUSCEPT_LAYER, IFFI_FILL].filter((id) => m.getLayer(id));
    if (layers.length === 0) return;
    const feats = m.queryRenderedFeatures(e.point, { layers });
    const cellFeat = feats.find((f) => f.layer.id === SUSCEPT_LAYER);
    const iffiFeat = feats.find((f) => f.layer.id === IFFI_FILL);
    if (!cellFeat && !iffiFeat) return;
    const cell: CellPopupProps | null = cellFeat
      ? {
          cell_id:
            (cellFeat.properties?.cell_id as number | string | undefined) ?? "?",
          p: Number(cellFeat.properties?.p ?? 0),
          zone: String(cellFeat.properties?.zone ?? ""),
          sub_zone: String(cellFeat.properties?.sub_zone ?? ""),
          iffi_hit: Boolean(cellFeat.properties?.iffi_hit),
        }
      : null;
    const iffi: IffiPopupProps | null = iffiFeat
      ? {
          id_frana: String(iffiFeat.properties?.id_frana ?? ""),
          tipo_movimento: String(iffiFeat.properties?.tipo_movimento ?? ""),
          nome_tipo: String(iffiFeat.properties?.nome_tipo ?? ""),
          comune: String(iffiFeat.properties?.comune ?? ""),
          provincia: String(iffiFeat.properties?.provincia ?? ""),
        }
      : null;
    new maplibregl.Popup({
      closeButton: true,
      closeOnClick: true,
      offset: 8,
      className: "feature-popup",
      maxWidth: "260px",
    })
      .setLngLat(e.lngLat)
      .setDOMContent(buildCombinedNode(cell, iffi))
      .addTo(m);
  };

  const cellEnter = () => {
    m.getCanvas().style.cursor = "pointer";
  };
  const cellLeave = () => {
    m.getCanvas().style.cursor = "";
  };

  m.on("click", onClick);
  m.on("mouseenter", SUSCEPT_LAYER, cellEnter);
  m.on("mouseleave", SUSCEPT_LAYER, cellLeave);
  m.on("mouseenter", IFFI_FILL, cellEnter);
  m.on("mouseleave", IFFI_FILL, cellLeave);

  return () => {
    m.off("click", onClick);
    m.off("mouseenter", SUSCEPT_LAYER, cellEnter);
    m.off("mouseleave", SUSCEPT_LAYER, cellLeave);
    m.off("mouseenter", IFFI_FILL, cellEnter);
    m.off("mouseleave", IFFI_FILL, cellLeave);
  };
}
