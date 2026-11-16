import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useAppStore } from "@/app/store";
import { useExperienceStore, closeArea, savedArea } from "./store";
import { AreasControl, AreasPanel } from "./AreasControl";
const geometry:GeoJSON.Polygon={type:"Polygon",coordinates:[[[13,46],[13.01,46],[13.01,46.01],[13,46]]]};
const add=(name:string)=>useAppStore.getState().addUserPolygon({spaceId:"landslides",name,geometry,bounds:[[13,46],[13.01,46.01]],stats:{areaKm2:.1,cellsVisible:null,cellsAboveThreshold:null,meanP:null,medianP:null,iffiCount:null,threshold:null,model:null}});
afterEach(()=>{useAppStore.setState({userPolygons:[],drawingMode:false});useExperienceStore.setState({activeId:null,area:null});});
it("recalls each saved area, hides the active contour without losing it and removes only the requested area",()=>{
 useExperienceStore.setState({activeId:"landslides",area:null});useAppStore.setState({userPolygons:[],drawingMode:false});const a=add("Area Nord");add("Area Sud");
 const fit=vi.fn();window.addEventListener("fvg:regional-fit",fit);
 render(<><AreasControl/><AreasPanel/></>);fireEvent.click(screen.getByRole("button",{name:/Aree/}));fireEvent.click(screen.getByRole("button",{name:"Inquadra e analizza Area Nord"}));
 expect(useExperienceStore.getState().area?.id).toBe(a.id);expect(fit).toHaveBeenCalledTimes(1);
 act(()=>closeArea());expect(useAppStore.getState().userPolygons).toHaveLength(2);expect(useAppStore.getState().userPolygons.find(p=>p.id===a.id)?.visible).toBe(false);expect(useExperienceStore.getState().area).toBeNull();
 act(()=>savedArea(a.id));expect(useAppStore.getState().userPolygons.find(p=>p.id===a.id)?.visible).toBe(true);
 fireEvent.click(screen.getByRole("button",{name:/Aree/}));fireEvent.click(screen.getByRole("button",{name:"Elimina Area Sud"}));fireEvent.click(screen.getByRole("button",{name:"Elimina area"}));expect(useAppStore.getState().userPolygons.map(p=>p.name)).toEqual(["Area Nord"]);
 window.removeEventListener("fvg:regional-fit",fit);
});
