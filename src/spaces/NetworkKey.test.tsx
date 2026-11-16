import { act, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { useAppStore } from "@/app/store";
import { useExperienceStore } from "./store";
import { NetworkKey } from "./NetworkKey";

afterEach(()=>{
 useAppStore.getState().reset();
 useExperienceStore.setState({activeId:null,analysisLayer:"bodies"});
});

it("shows the thematic key only inside Frane and resets it immediately on leaving",()=>{
 useAppStore.setState(s=>({layers:{...s.layers,v2Bodies:true,v2Diffuse:true}}));
 useExperienceStore.setState({activeId:null});
 render(<NetworkKey/>);
 expect(screen.getByText(/Rete di contesto neutra/)).toBeInTheDocument();
 expect(screen.queryByRole("group",{name:"Mappatura delle reti"})).toBeNull();
 expect(screen.queryByRole("list")).toBeNull();
 act(()=>useExperienceStore.setState({activeId:"landslides"}));
 expect(screen.getByRole("group",{name:"Mappatura delle reti"})).toBeInTheDocument();
 expect(screen.getAllByRole("listitem")).toHaveLength(5);
 act(()=>useExperienceStore.setState({analysisLayer:"diffuse"}));
 expect(screen.getByText("Strade e sentieri · franosità diffusa")).toBeInTheDocument();
 act(()=>useExperienceStore.setState({activeId:"fire"}));
 expect(screen.queryByRole("list")).toBeNull();
 expect(screen.queryByRole("group",{name:"Mappatura delle reti"})).toBeNull();
 expect(screen.getByText(/Rete di contesto neutra/)).toBeInTheDocument();
});
