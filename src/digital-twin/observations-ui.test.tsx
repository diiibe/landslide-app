import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TwinPanel } from "./Panel";
import { ObservedSeriesChart } from "./ObservedSeriesChart";
import { EMPTY_FEED, useTwinStore } from "./store";
import { parseMeasures } from "./data";
const rows = parseMeasures({ measures: [
 { station_id: 212, sensor_id: 6, station_name: "Trieste", lon: 13.75, lat: 45.65, value: 3.8, dt: "2026-11-08 15:30:00" },
 { station_id: 212, sensor_id: 6, station_name: "Trieste", lon: 13.75, lat: 45.65, value: 4, dt: "2026-11-08 15:45:00" },
]}, false);
afterEach(()=> {cleanup();vi.restoreAllMocks();vi.unstubAllGlobals()});
it("inspects historical samples without changing latest map observations",()=>{
 useTwinStore.setState({ variable:"wind", measures:[rows[1]!] });
 render(<ObservedSeriesChart rows={rows} unit="m/s" />);
 const slider=screen.getByRole('slider',{name:'Esplora i campioni osservati'});
 expect(slider).toHaveAttribute('aria-valuetext',expect.stringContaining('4 m/s'));
 fireEvent.change(slider,{target:{value:'0'}});
 expect(slider).toHaveAttribute('aria-valuetext',expect.stringContaining('3,8 m/s'));
 expect(screen.getByText('3,8 m/s')).toBeVisible();
 expect(useTwinStore.getState().measures[0]!.value).toBe(4);
 expect(useTwinStore.getState().variable).toBe('wind');
});
it("groups all variables and keeps an explicit missing observation when changing variable",async()=>{
 vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response('',{status:503}));
 useTwinStore.setState({variable:'wind',measures:[rows[1]!],selection:{kind:'sensor',stationId:212},sensorsFeed:{...EMPTY_FEED},radarFeed:{...EMPTY_FEED}});
 render(<TwinPanel/>);
 const picker=screen.getByRole('combobox',{name:'Dati sulla mappa · Osservazioni PCR'});
 expect(picker.querySelectorAll('option')).toHaveLength(19);
 expect([...picker.querySelectorAll('optgroup')].map(x=>x.label)).toEqual(['Meteo','Acqua e costa','Suolo e verde']);
 fireEvent.change(picker,{target:{value:'hydro'}});
 expect(screen.getByText(/Riferimenti locali: confronta/)).toBeVisible();
 expect(screen.queryByLabelText(/Scala di/)).not.toBeInTheDocument();
 expect(screen.getByRole('combobox',{name:'Stazione'})).toHaveValue('212');
 expect(screen.getByRole('option',{name:'Trieste · dato assente'})).toBeInTheDocument();
 expect(screen.getByText(/Questa stazione non ha una misura/)).toBeVisible();
 await screen.findByText(/Altre misure della stazione/);
});
it("uses the agreed fit and station event contracts",async()=>{
 vi.stubGlobal('matchMedia',()=>({matches:false}));
 vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response('',{status:503}));
 useTwinStore.setState({variable:'wind',measures:[rows[1]!],selection:{kind:'sensor',stationId:212}});
 const fit=vi.fn(),station=vi.fn();
 window.addEventListener('fvg:twin-fit',fit);window.addEventListener('fvg:twin-station',station);
 render(<TwinPanel/>);
 fireEvent.click(screen.getByRole('button',{name:'Inquadra stazioni'}));
 fireEvent.click(screen.getByRole('button',{name:'Mostra sulla mappa'}));
 expect(fit).toHaveBeenCalledOnce();expect(station.mock.calls[0]![0].detail).toBe(212);
 window.removeEventListener('fvg:twin-fit',fit);window.removeEventListener('fvg:twin-station',station);
 await screen.findByText(/Serie non disponibile/);
 vi.unstubAllGlobals();
});
