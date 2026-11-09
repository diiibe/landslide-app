import { it, expect } from "vitest";
import type { StyleSpecification } from "maplibre-gl";
import { validateStyleMin } from "@maplibre/maplibre-gl-style-spec";
import { presentation } from "./presentation";
import { regionalStyle } from "./mapStyle";
import catalog from "../../public/data/regional/catalog.json";
import type { LayerDefinition } from "./types";

it("gives every imported distribution a representation and never treats observations as density", () => {
  for (const l of catalog.layers as LayerDefinition[]) {
    const p = presentation(l);
    expect(p.description, l.id).toBeTruthy();
    if (l.metric || l.live || l.liveKind === "pcr") expect(p.density, l.id).toBe(false);
  }
});
it("produces valid MapLibre styles for every ready vector/GeoJSON distribution and mode", () => {
  const errors: string[] = [];
  for (const l of catalog.layers as LayerDefinition[]) {
    if (!["geojson", "vector"].includes(l.kind ?? "") || l.status !== "ready") continue;
    for (const mode of ["auto", "points", ...(presentation(l).density ? ["density"] : [])] as ("auto"|"points"|"density")[]) {
      const id = "regional-"+l.id;
      const source = l.kind === "vector" ? { type: "vector", tiles: ["https://example.com/{z}/{x}/{y}.pbf"] } : { type: "geojson", data: { type: "FeatureCollection", features: [] } };
      const style = {version: 8, glyphs: "https://example.com/{fontstack}/{range}.pbf", sources: { [id]: source, [id+"-overview-source"]: {type:"geojson",data:{type:"FeatureCollection",features:[]}} }, layers: regionalStyle(l, .7, mode, ["Open Sans Semibold"]) };
      errors.push(...validateStyleMin(style as StyleSpecification).map(e=>l.id+"/"+mode+": "+e.message));
    }
  }
  expect(errors).toEqual([]);
});
it("keeps censored data neutral, direction angular and local hydrometers uniform", () => {
  const base = catalog.layers.find(l=>l.sourceId === "qp5k-6pvm") as LayerDefinition;
  expect(presentation(base).type).toBe("measurement");
  const hydro={...base, title:"Idrometro_2",liveKind:"pcr" as const};
  expect(presentation(hydro).local).toBe(true);
  expect(regionalStyle(base,.7,"auto",["Open Sans"]).find(l=>l.id.endsWith("-point"))?.paint).toHaveProperty("circle-color");
  const dir={...base,title:"Direzione vento",metric:{field:"__value",unit:"°N"}};
  const arrows=regionalStyle(dir,1,"auto",["Open Sans"]).find(l=>l.id.endsWith("-direction"));
  expect(arrows?.type).toBe("symbol");
});

it("recognizes each directional unit used by OGS, PCR and bathing observations", () => {
  for(const id of ["ogs-mambo3-wdir","ogs-mambo3-gdir","open-fpj6-y9vk-direzione-della-corrente","ogs-wave-vped"]){
    const l=(catalog.layers as LayerDefinition[]).find(l=>l.id===id)!;
    expect(presentation(l).type,id).toBe("direction");
  }
});
