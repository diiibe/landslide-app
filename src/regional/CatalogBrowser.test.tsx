import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { CatalogBrowser } from "./CatalogBrowser";
import { useRegionalStore } from "./store";
import { THEMES } from "./catalog";
beforeEach(()=>{
  vi.stubGlobal("matchMedia", vi.fn(()=>({matches:true,addEventListener:vi.fn(),removeEventListener:vi.fn()})));
  HTMLDialogElement.prototype.showModal=function(){this.setAttribute("open","");};
  HTMLDialogElement.prototype.close=function(){this.removeAttribute("open");};
  useRegionalStore.setState({catalogOpen:true,catalog:null,catalogError:null,enabled:{},display:{}});
});
afterEach(()=>vi.unstubAllGlobals());
it("starts mobile with filters closed, every category available and no keyboard autofocus",()=>{
  render(<CatalogBrowser/>);
  const dialog=screen.getByRole("dialog",{name:"Catalogo dei dati"});
  expect(within(dialog).getByRole("button",{name:"Filtri"})).toHaveAttribute("aria-expanded","false");
  expect(within(dialog).getByRole("heading",{name:"Catalogo dei dati"})).toHaveFocus();
  const nav=within(dialog).getByRole("navigation",{name:"Temi del catalogo"});
  expect(within(nav).getAllByRole("button")).toHaveLength(Object.keys(THEMES).length+1);
  const explorer=dialog.querySelector('[data-mode="catalog"]')!;
  expect(explorer).toHaveAttribute("data-categories","true");
  fireEvent.click(within(nav).getByRole("button",{name:/Frane e versanti/}));
  expect(explorer).toHaveAttribute("data-categories","false");
  fireEvent.click(within(dialog).getByRole("button",{name:"Categorie"}));
  expect(explorer).toHaveAttribute("data-categories","true");
  fireEvent.click(within(nav).getByRole("button",{name:/Tutti i dati/}));
  expect(explorer).toHaveAttribute("data-categories","false");
});
it("preserves refinements while collapsing them and resets their mobile state on reopen",()=>{
 const view=render(<CatalogBrowser/>);
 const dialog=screen.getByRole("dialog",{name:"Catalogo dei dati"});
 const disclosure=within(dialog).getByRole('button',{name:'Filtri'});
 fireEvent.click(disclosure);
 const query=within(dialog).getByRole('searchbox',{name:'Cerca nel catalogo'});
 fireEvent.change(query,{target:{value:'vento'}});
 expect(dialog.querySelector('[data-mode="catalog"]')).toHaveAttribute('data-categories','false');
 fireEvent.click(disclosure);
 expect(query).toHaveValue('vento');
 useRegionalStore.setState({catalogOpen:false});view.rerender(<CatalogBrowser/>);
 useRegionalStore.setState({catalogOpen:true});view.rerender(<CatalogBrowser/>);
 expect(within(dialog).getByRole('button',{name:'Filtri'})).toHaveAttribute('aria-expanded','false');
 expect(within(dialog).getByRole('searchbox',{name:'Cerca nel catalogo'})).toHaveValue('');
});

it("keeps catalog failures visible above the mobile category/results switch and permits retry",()=>{
 useRegionalStore.setState({catalogError:"HTTP 503",refreshKey:0});
 render(<CatalogBrowser/>);
 const alert=screen.getByRole("alert");
 expect(alert.parentElement).toHaveAttribute("data-mode","catalog");
 expect(alert.parentElement).toHaveAttribute("data-categories","true");
 fireEvent.click(within(alert).getByRole("button",{name:"Riprova adesso"}));
 expect(useRegionalStore.getState().refreshKey).toBe(1);
});

it("keeps desktop refinements opt-in and returns focus to their disclosure",()=>{
 vi.stubGlobal("matchMedia",vi.fn(()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()})));
 render(<CatalogBrowser/>);
 const toggle=screen.getByRole("button",{name:"Filtri"});
 const fields=document.getElementById(toggle.getAttribute("aria-controls")!)!;
 expect(fields).not.toBeVisible();
 fireEvent.click(toggle);
 expect(fields).toBeVisible();
 expect(toggle).toHaveFocus();
 fireEvent.click(toggle);
 expect(fields).not.toBeVisible();
 expect(toggle).toHaveFocus();
});
