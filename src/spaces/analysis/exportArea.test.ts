import { expect, it } from "vitest";
import { areaExportContent, areaReport, areaRows } from "./exportArea";
import { parseBundleFile } from "@/lib/bundle";
import type { AnalysisResult } from "./core";
const geometry: GeoJSON.Polygon = {type:"Polygon",coordinates:[[[13,46],[13.01,46],[13.01,46.01],[13,46]]]};
const layer = { coveredM2:4000,belowFocusM2:3000,cells:2,classes:[100,200,0,300,400],mean:.1,median:.09,p90:.2,min:0,max:.8 };
const result: AnalysisResult = {areaM2:5000,layers:{bodies:layer,diffuse:layer},version:"original-grid:model-breaks",method:"Intersezione UTM 33N",classification:{scheme:"upper-quintile-v1",edges:{bodies:[.05,.1,.2,.3,.4,1],diffuse:[.1,.2,.3,.4,.5,.8]},note:"Fascia alta"},networks:{roads:{totalKm:2,bodiesKm:[1,0,0,0,0,1],diffuseKm:[1,0,0,0,0,1],segments:10,belowFocusKm:{bodies:.7,diffuse:.7}},trails:{totalKm:0,bodiesKm:[0,0,0,0,0,0],diffuseKm:[0,0,0,0,0,0],segments:0}}};
const make = (name="Zona di prova") => areaReport({id:"area-1",name,geometry,saved:true},result,{bodies:[4,5],diffuse:[5]},new Date("2026-11-16T11:00:00Z"));
it("exports a usable WGS84 perimeter with complete data and can reimport it as an area",()=>{
 const output=areaExportContent("geojson",make());const json=JSON.parse(output.text),p=json.features[0].properties;
 expect(json.features[0].geometry).toEqual(geometry);expect(p.analysis.layers.bodies.belowFocusM2).toBe(3000);expect(p.model_version).toBe(result.version);expect(p["Corpi di frana | Grado 5 · superficie [m2]"]).toBe(400);
 const imported=parseBundleFile(output.text);expect(imported.polygons).toHaveLength(1);expect(imported.polygons[0]?.geometry).toEqual(geometry);expect(imported.polygons[0]?.spaceId).toBe("landslides");expect(imported.polygons[0]?.stats.meanP).toBeNull();
});
it("keeps below-focus mapped data and no-data distinct, with units and positive small values",()=>{
 const rows=areaRows(make());expect(rows).toContainEqual(["Zona di prova","Corpi di frana","Mappata sotto la fascia alta",3000,"m2"]);expect(rows).toContainEqual(["Zona di prova","Corpi di frana","Senza mappatura",1000,"m2"]);
 expect(rows.find(r=>r[2]==="Strade · senza mappatura")?.[3]).toBeCloseTo(.3);
 const csv=areaExportContent("csv",make("=HYPERLINK(1)")).text;expect(csv).toContain('"\'=HYPERLINK(1)"');expect(csv).toContain('"Grado 1 · superficie";"100";"m2"');expect(csv).toContain(result.version!);
});
it("escapes report content and preserves all classes even if hidden on the map",()=>{
 const html=areaExportContent("html",make('<script>alert("x")</script>')).text;expect(html).not.toContain('<script>');expect(html).toContain('&lt;script&gt;');expect(html).toContain('Grado 1 · superficie');expect(html).toContain('Gradi accesi sulla mappa: 4, 5');expect(html).toContain('stampata in PDF');
 const json=JSON.parse(areaExportContent("json",make()).text);expect(json.grid.cellSizeM).toBe(120);expect(json.result.layers.bodies.classes).toEqual(layer.classes);
});

it("preserves a saved perimeter's chosen colour and original creation time on reimport",()=>{
 const report=areaReport({id:"saved",name:"Perimetro rosa",geometry,saved:true,color:"#ff3fa4",createdAt:12345},result,{bodies:[1],diffuse:[2]});
 const parsed=JSON.parse(areaExportContent("geojson",report).text);expect(parsed.features[0].properties.color).toBe("#ff3fa4");expect(parsed.features[0].properties.createdAt).toBe(12345);expect(parseBundleFile(JSON.stringify(parsed)).polygons[0]?.color).toBe("#ff3fa4");
});
