import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Workbench } from "./Workbench";
import { useExperienceStore } from "../store";
import { FraneComparison } from "./FraneComparison";
import { analyseArea } from "../analysis/client";
import type { AnalysisResult } from "../analysis/core";
vi.mock("../analysis/client",()=>({analyseArea:vi.fn()}));
beforeEach(()=>{vi.stubGlobal("ResizeObserver",class{observe(){}disconnect(){}});});
afterEach(()=>{useExperienceStore.setState({activeId:null,tab:"overview",replayTime:null,scenario:{id:"normal",since:0},selectedId:null});vi.restoreAllMocks();vi.unstubAllGlobals();});
it("offers one relevant tool in each demo, and changes a road hypothesis without changing the base scenario",()=>{
 useExperienceStore.setState({activeId:"traffic",tab:"tools",replayTime:Date.parse("2026-11-10T10:00:00Z")});
 render(<Workbench/>);
 expect(screen.getByRole("heading",{name:"Laboratorio di viabilità"})).toBeInTheDocument();
 fireEvent.click(screen.getByText("Modifica i parametri dell’ipotesi"));
 const before=useExperienceStore.getState().scenario;
 fireEvent.change(screen.getByRole("slider",{name:"Capacità disponibile rispetto alla base"}),{target:{value:"50"}});
 expect(screen.getByText("50 %")).toBeInTheDocument();
 expect(useExperienceStore.getState().scenario).toEqual(before);
 expect(screen.getByText(/replay · scenario/)).toBeInTheDocument();
});
it("never presents an unavailable landslide comparison as zero and hides results for changed zones",async()=>{
 const make=():AnalysisResult=>({areaM2:10000,layers:{bodies:{coveredM2:0,cells:0,classes:[0,0,0,0,0],mean:null,median:null,p90:null,min:null,max:null},diffuse:{coveredM2:0,cells:0,classes:[0,0,0,0,0],mean:null,median:null,p90:null,min:null,max:null}},version:"index-test"});
 vi.mocked(analyseArea).mockResolvedValue(make());
 render(<FraneComparison/>);
 fireEvent.click(screen.getByRole("button",{name:"Calcola confronto"}));
 await waitFor(()=>expect(screen.getAllByText("Non disponibile")).toHaveLength(4));
 expect(screen.getAllByText(/Indice index-test/)).toHaveLength(2);
 fireEvent.click(screen.getByRole("combobox",{name:"Seconda zona da confrontare"}));
 fireEvent.click(screen.getByRole("option",{name:/Tolmezzo/}));
 expect(screen.queryByText(/Indice index-test/)).not.toBeInTheDocument();
 expect(screen.getByText(/Ricalcola per aggiornare/)).toBeInTheDocument();
});
it("keeps a source failure visible instead of fabricating analysis values",async()=>{
 vi.mocked(analyseArea).mockRejectedValue(new Error("Indice non disponibile"));
 render(<FraneComparison/>);fireEvent.click(screen.getByRole("button",{name:"Calcola confronto"}));
 await waitFor(()=>expect(screen.getAllByRole("alert")).toHaveLength(2));
 expect(screen.queryByRole("button",{name:"Esporta confronto JSON"})).not.toBeInTheDocument();
});
it("updates a report when replay time changes, using that chosen instant",()=>{
 useExperienceStore.setState({activeId:"retail",tab:"tools",replayTime:Date.parse("2026-11-10T02:00:00Z")});
 render(<Workbench/>);
 expect(screen.getByText(/03:00 · replay/)).toBeInTheDocument();
 act(()=>useExperienceStore.setState({replayTime:Date.parse("2026-11-10T12:00:00Z")}));
 expect(screen.getByText(/13:00 · replay/)).toBeInTheDocument();
});

it("keeps a small mapped area and a small unmapped remainder visible instead of rounding to zero",async()=>{
 const layer={coveredM2:4000,cells:1,classes:[0,0,4000,0,0],mean:.5,median:.5,p90:.5,min:.5,max:.5};
 vi.mocked(analyseArea).mockResolvedValue({areaM2:8000,layers:{bodies:layer,diffuse:layer},version:"small"});
 render(<FraneComparison/>);fireEvent.click(screen.getByRole("button",{name:"Calcola confronto"}));
 await waitFor(()=>expect(screen.getAllByText("0,004 km²")).toHaveLength(2));
 expect(screen.getAllByText(/Senza mappatura: 0,004 km²/)).toHaveLength(2);
});
