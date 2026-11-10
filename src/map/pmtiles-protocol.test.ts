import {expect,it,vi} from "vitest";
const {tile,addProtocol}=vi.hoisted(()=>({tile:vi.fn(),addProtocol:vi.fn()}));
vi.mock("pmtiles",()=>({Protocol:class {tile=tile;}}));
vi.mock("maplibre-gl",()=>({default:{addProtocol}}));
import {installPmtilesProtocol} from "./pmtiles-protocol";
it("settles missing raster tiles with transparency while preserving metadata, vectors, errors and cancellation",async()=>{
 installPmtilesProtocol();installPmtilesProtocol();expect(addProtocol).toHaveBeenCalledOnce();
 const handler=addProtocol.mock.calls[0]![1];const controller=new AbortController();const request={url:"pmtiles://test/8/1/2",type:"image"};
 tile.mockResolvedValueOnce({data:null});const missing=await handler(request,controller);
 expect([...missing.data.slice(0,8)]).toEqual([137,80,78,71,13,10,26,10]);
 expect(tile).toHaveBeenCalledWith(request,controller);
 const vector=new Uint8Array();tile.mockResolvedValueOnce({data:vector});expect((await handler(request,controller)).data).toBe(vector);
 const json={tiles:[]};tile.mockResolvedValueOnce({data:json});expect((await handler({...request,type:"json"},controller)).data).toBe(json);
 tile.mockRejectedValueOnce(new Error("HTTP503"));await expect(handler(request,controller)).rejects.toThrow("HTTP503");
});
