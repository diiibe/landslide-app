import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { Drawer } from "./Drawer";
import { useAppStore } from "@/app/store";
import { useExperienceStore } from "@/spaces/store";
afterEach(()=>{useAppStore.setState({drawerOpen:false,drawingMode:false});useExperienceStore.setState({activeId:null,tab:"overview"});});
it("labels the areas panel and returns keyboard focus to its own trigger",()=>{
 useAppStore.setState({drawerOpen:true,drawingMode:false});useExperienceStore.setState({activeId:"landslides",tab:"areas"});
 render(<><button id="areas-trigger">Aree</button><button id="layers-trigger">Livelli</button><Drawer label="Le tue aree"><h2>Aree salvate</h2></Drawer></>);
 fireEvent.click(screen.getByRole("button",{name:"Chiudi aree"}));expect(screen.getByRole("button",{name:"Aree"})).toHaveFocus();expect(useAppStore.getState().drawerOpen).toBe(false);
});
