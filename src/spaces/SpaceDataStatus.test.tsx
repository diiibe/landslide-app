import { render, screen, fireEvent } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { SpaceDataStatus } from "./SpaceDataStatus";
import { useExperienceStore } from "./store";
import { useRegionalStore } from "@/regional/store";
import { useTwinStore, EMPTY_FEED } from "@/digital-twin/store";
afterEach(()=>{useExperienceStore.setState({activeId:null,replayTime:null});useRegionalStore.setState({catalog:null,entries:{},enabled:{}});useTwinStore.setState({radarFeed:{...EMPTY_FEED},radar:null});});
it("describes radar as an automatically checked observation rather than a static archive",()=>{
 useExperienceStore.setState({activeId:"industry",replayTime:null});
 useRegionalStore.setState({catalog:null,enabled:{"pcr-radar":true,"pcr-wind":false}});
 useTwinStore.setState({radarFeed:{...EMPTY_FEED,receivedAt:Date.now()}});
 render(<SpaceDataStatus/>);
 fireEvent.click(screen.getByText(/Catalogo e aggiornamenti/));
 expect(screen.getByText("Fonte ricontrollata automaticamente")).toBeInTheDocument();
 expect(screen.queryByText("Archivio / dato versionato")).not.toBeInTheDocument();
});
