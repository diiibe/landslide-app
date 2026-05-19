import maplibregl, { type Map as MLMap, type MapMouseEvent } from "maplibre-gl";
import { SUSCEPT_LAYER } from "./layers/susceptibility";
import { IFFI_FILL } from "./layers/iffi";
import { HFLOOD_FILL } from "./layers/historicalFloods";

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

/** Subset of the historical-flood GeoJSON feature properties we use to
 *  build the popup. The source pipeline emits 5 keys; we read 4 of
 *  them, plus parse the `event_id` to extract the AOI name. */
export interface HFloodPopupProps {
  event_id: string;
  product: string;       // "GRADING" | "DELINEATION"
  product_kind: string;  // "flood" | "hydro_damage"
  src_date: string;      // ISO date or "" (only some records carry it)
  obj_desc: string;      // "Riverine flood" or ""
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

/** Map Copernicus EMS activation codes to a human-readable event title
 *  + a short Italian month/year tag for the popup headline. The current
 *  geojson carries two activations (EMSR225 / EMSR332). New activations
 *  picked up by the export pipeline fall back to the raw code so the
 *  popup is never empty. */
const HFLOOD_ACTIVATIONS: Record<string, { name: string; when: string }> = {
  EMSR225: { name: "Storm in Friuli", when: "ago 2017" },
  EMSR332: { name: "Vaia", when: "ott 2018" },
};

/** Parse an event_id like `EMSR332_08PORDENONE_01DELINEATION_MONIT01`
 *  into `{ activation, aoi }`. The AOI slug is just the human part of
 *  the second segment (`PORDENONE`, `SANVITO`, …) — the leading two
 *  digits are a sequence number that means nothing to the user. */
function parseHFloodEventId(eventId: string): { activation: string; aoi: string } {
  const parts = eventId.split("_");
  const activation = parts[0] ?? "";
  const aoiRaw = parts[1] ?? "";
  // Strip the leading "NN" sequence number to get the bare locality name.
  const aoi = aoiRaw.replace(/^\d+/, "");
  return { activation, aoi };
}

const HFLOOD_KIND_LABEL: Record<string, string> = {
  flood: "Inondazione osservata",
  hydro_damage: "Danno idrologico",
};

export function buildHFloodPopupNode(p: HFloodPopupProps): HTMLElement {
  const root = document.createElement("div");
  root.className = "fvg-popup";
  root.style.minWidth = "200px";

  const { activation, aoi } = parseHFloodEventId(p.event_id);
  const meta = HFLOOD_ACTIVATIONS[activation];

  const title = document.createElement("div");
  title.className = "fvg-popup__title";
  // Headline: human-readable event name, or fall back to the bare code.
  title.textContent = meta ? `${meta.name} (${meta.when})` : activation || "Alluvione storica";
  root.appendChild(title);

  // Strong line: kind humanised (Inondazione / Danno idrologico). If we
  // also have a richer Copernicus description we prefer it.
  const kindLabel = p.obj_desc || HFLOOD_KIND_LABEL[p.product_kind] || p.product_kind;
  if (kindLabel) {
    const kind = document.createElement("div");
    kind.className = "fvg-popup__strong";
    kind.textContent = kindLabel;
    root.appendChild(kind);
  }

  // CAPS tag: product type (Copernicus "DELINEATION" / "GRADING") — same
  // visual slot the IFFI popup uses for the movement code.
  if (p.product) {
    const product = document.createElement("div");
    product.className = "fvg-popup__caps";
    product.textContent = p.product;
    root.appendChild(product);
  }

  // Muted footer: AOI + activation code + source date when present.
  const footerParts: string[] = [];
  if (aoi) footerParts.push(aoi);
  if (activation) footerParts.push(activation);
  if (p.src_date) footerParts.push(p.src_date);
  if (footerParts.length > 0) {
    const place = document.createElement("div");
    place.className = "fvg-popup__muted";
    place.style.marginTop = "4px";
    place.textContent = footerParts.join(" · ");
    root.appendChild(place);
  }

  return root;
}

/**
 * Build a single combined popup node when the click lands on more than
 * one interactive layer at the same point. The sections sit one above
 * the other inside one card; thin dividers separate them. Each argument
 * may be `null` — the resulting node renders only the relevant
 * sections.
 */
function buildCombinedNode(
  cell: CellPopupProps | null,
  iffi: IffiPopupProps | null,
  hflood: HFloodPopupProps | null,
): HTMLElement {
  const root = document.createElement("div");
  root.className = "fvg-popup fvg-popup--stack";
  const sections: HTMLElement[] = [];
  if (cell) sections.push(buildCellPopupNode(cell));
  if (iffi) sections.push(buildIffiPopupNode(iffi));
  if (hflood) sections.push(buildHFloodPopupNode(hflood));
  sections.forEach((node, i) => {
    if (i > 0) {
      const sep = document.createElement("div");
      sep.className = "fvg-popup__divider";
      root.appendChild(sep);
    }
    root.appendChild(node);
  });
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
    const layers = [SUSCEPT_LAYER, IFFI_FILL, HFLOOD_FILL].filter((id) =>
      m.getLayer(id),
    );
    if (layers.length === 0) return;
    const feats = m.queryRenderedFeatures(e.point, { layers });
    const cellFeat = feats.find((f) => f.layer.id === SUSCEPT_LAYER);
    const iffiFeat = feats.find((f) => f.layer.id === IFFI_FILL);
    const hfloodFeat = feats.find((f) => f.layer.id === HFLOOD_FILL);
    if (!cellFeat && !iffiFeat && !hfloodFeat) return;
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
    const hflood: HFloodPopupProps | null = hfloodFeat
      ? {
          event_id: String(hfloodFeat.properties?.event_id ?? ""),
          product: String(hfloodFeat.properties?.product ?? ""),
          product_kind: String(hfloodFeat.properties?.product_kind ?? ""),
          src_date: String(hfloodFeat.properties?.src_date ?? ""),
          obj_desc: String(hfloodFeat.properties?.obj_desc ?? ""),
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
      .setDOMContent(buildCombinedNode(cell, iffi, hflood))
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
  m.on("mouseenter", HFLOOD_FILL, cellEnter);
  m.on("mouseleave", HFLOOD_FILL, cellLeave);

  return () => {
    m.off("click", onClick);
    m.off("mouseenter", SUSCEPT_LAYER, cellEnter);
    m.off("mouseleave", SUSCEPT_LAYER, cellLeave);
    m.off("mouseenter", IFFI_FILL, cellEnter);
    m.off("mouseleave", IFFI_FILL, cellLeave);
    m.off("mouseenter", HFLOOD_FILL, cellEnter);
    m.off("mouseleave", HFLOOD_FILL, cellLeave);
  };
}
