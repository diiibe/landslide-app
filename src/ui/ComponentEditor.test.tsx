import { render, screen, fireEvent, act } from "@testing-library/react";
import { afterEach, beforeEach, expect, it } from "vitest";
import { ComponentEditor } from "./ComponentEditor";
import { useInterfaceSettings } from "./interfaceSettings";
beforeEach(()=>useInterfaceSettings.getState().reset());
afterEach(()=>useInterfaceSettings.getState().reset());
it("allows replacing the whole label and typing multiword names, then reflects a component reset",()=>{
 render(<ComponentEditor component="navbar"/>);
 const field=screen.getByRole("textbox",{name:"Marchio"});
 fireEvent.change(field,{target:{value:""}});expect(field).toHaveValue("");
 fireEvent.change(field,{target:{value:"Nuovo "}});expect(field).toHaveValue("Nuovo ");
 fireEvent.change(field,{target:{value:"Nuovo territorio"}});expect(useInterfaceSettings.getState().config.texts.brand).toBe("Nuovo territorio");
 act(()=>useInterfaceSettings.getState().reset("navbar"));expect(field).toHaveValue("FriulView");
});
