import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useAppStore } from "@/app/store";
import { DrawingPanel } from "./DrawingPanel";
const api = vi.hoisted(()=>({undo:vi.fn(),restart:vi.fn(),finish:vi.fn()}));
vi.mock("@/map/drawing",()=>({cancelDrawing:vi.fn(),commitDrawing:vi.fn(),undoDrawingVertex:api.undo,restartDrawing:api.restart,finishDrawing:api.finish,subscribeDrawingPreview:(fn:(p:unknown)=>void)=>{fn({phase:"drawing",vertexCount:3,areaKm2:.5,canUndo:true});return ()=>{};}}));
afterEach(()=>{useAppStore.setState({drawingMode:false});vi.clearAllMocks();});
it("offers exactly one set of real editing actions and wires them to the drawing tool",()=>{
 useAppStore.setState({drawingMode:true});render(<DrawingPanel/>);
 expect(screen.getAllByRole("group",{name:"Correggi il contorno"})).toHaveLength(1);
 fireEvent.click(screen.getByRole("button",{name:"Indietro"}));fireEvent.click(screen.getByRole("button",{name:"Riparti da zero"}));fireEvent.click(screen.getByRole("button",{name:"Chiudi contorno"}));
 expect(api.undo).toHaveBeenCalledOnce();expect(api.restart).toHaveBeenCalledOnce();expect(api.finish).toHaveBeenCalledOnce();
});
