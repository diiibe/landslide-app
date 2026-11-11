import { beforeEach, expect, it, vi } from "vitest";
import { interfaceCSS, readInterface, useInterfaceSettings, validateInterface } from "./interfaceSettings";
import { useAppStore } from "@/app/store";
beforeEach(()=>{localStorage.removeItem("friulview:interface:v1");useInterfaceSettings.getState().reset();});
it("persists independent component styling and text without touching map layers or measurements",()=>{
 const layers=useAppStore.getState().layers;
 const store=useInterfaceSettings.getState();
 store.setStyle("navbar",{background:"#243528",texture:"territory",intensity:20,size:16});
 store.setStyle("catalogButton",{depth:3});store.setText("brand","FriulView Studio");
 expect(readInterface().components.navbar?.background).toBe("#243528");
 expect(readInterface().texts.brand).toBe("FriulView Studio");
 expect(document.getElementById("friulview-interface-overrides")?.textContent).toContain('data-ui="navbar"');
 expect(useAppStore.getState().layers).toBe(layers);
 store.reset("navbar");
 expect(readInterface().components.navbar).toBeUndefined();expect(readInterface().texts.brand).toBeUndefined();
 expect(readInterface().components.catalogButton?.depth).toBe(3);
});
it("rejects injected CSS, unknown fonts, non-finite values and empty names atomically",()=>{
 const initial=useInterfaceSettings.getState().config;
 for(const style of [{background:'red;display:none'},{font:'toString'},{size:NaN},{opacity:0},{texture:'url(evil)'}]){
  expect(()=>useInterfaceSettings.getState().load({version:1,components:{navbar:style},texts:{}})).toThrow();
  expect(useInterfaceSettings.getState().config).toBe(initial);
 }
 expect(()=>validateInterface({version:1,components:{},texts:{brand:" "}})).toThrow();
 localStorage.setItem("friulview:interface:v1","bad");expect(readInterface().components).toEqual({});
});
it("preserves typed spaces and scopes fonts away from nested independently configured components",()=>{
 useInterfaceSettings.getState().setText("catalog","Nuovo ");
 expect(useInterfaceSettings.getState().config.texts.catalog).toBe("Nuovo ");
 const css=interfaceCSS({version:1,components:{navbar:{size:18,font:"serif"},search:{size:12,font:"manrope"}},texts:{}});
 expect(css).toContain(':not([data-ui="navbar"] [data-ui],[data-ui="navbar"] [data-ui] *)');
 expect(css).toContain('font-size:16px!important');
 expect(css).not.toContain('circle-color');
});

it("keeps changes active and reports when the browser refuses persistence",()=>{
 const storage=vi.spyOn(Storage.prototype,"setItem").mockImplementation(()=>{throw new Error("storage full")});
 try {useInterfaceSettings.getState().setStyle("search",{depth:3});expect(useInterfaceSettings.getState().persistent).toBe(false);expect(useInterfaceSettings.getState().config.components.search?.depth).toBe(3);} finally {storage.mockRestore();}
});
