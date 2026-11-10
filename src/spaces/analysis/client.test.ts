import { beforeEach, afterEach, expect, it, vi } from "vitest";
import type { AnalysisResult } from "./core";
const geometry:GeoJSON.Polygon={type:"Polygon",coordinates:[[[13,46],[13.01,46],[13.01,46.01],[13,46]]]};
const result:AnalysisResult={areaM2:1,layers:{bodies:{coveredM2:0,cells:0,classes:[0,0,0,0,0],mean:null,median:null,p90:null,min:null,max:null},diffuse:{coveredM2:0,cells:0,classes:[0,0,0,0,0],mean:null,median:null,p90:null,min:null,max:null}}};
const manifest=(sha:string)=>({modelHash:sha,modelGrid:{sha},networks:{roads:{sha:"roads"},trails:{sha:"trails"}}});
const response=(sha:string)=>({ok:true,json:async()=>manifest(sha)}) as Response;
class FakeWorker {
 onmessage:((e:MessageEvent)=>void)|null=null;
 terminate=vi.fn();
 constructor(){created.push(this);}
 postMessage(m:{id:number}){queueMicrotask(()=>this.onmessage?.({data:{id:m.id,result}} as MessageEvent));}
}
let created:FakeWorker[]=[];
beforeEach(()=>{vi.resetModules();created=[];vi.stubGlobal("Worker",FakeWorker);});
afterEach(()=>{vi.unstubAllGlobals();});
it("checks a reopened Space against the published version, reuses unchanged data and replaces a changed worker",async()=>{
 const fetcher=vi.fn(async()=>response("one"));vi.stubGlobal("fetch",fetcher);
 const client=await import("./client");
 await client.analyseArea(geometry);await client.analyseArea(geometry);
 expect(fetcher).toHaveBeenCalledTimes(1);expect(created).toHaveLength(1);
 client.invalidateAnalysisVersion();await client.analyseArea(geometry);
 expect(created).toHaveLength(1);expect(created[0]!.terminate).not.toHaveBeenCalled();
 fetcher.mockResolvedValue(response("two"));client.invalidateAnalysisVersion();await client.analyseArea(geometry);
 expect(created).toHaveLength(2);expect(created[0]!.terminate).toHaveBeenCalledTimes(1);
 expect(fetcher.mock.calls[0]?.length).toBe(2);
});
it("reports a failed version check and allows retry instead of silently using an unchecked index",async()=>{
 const fetcher=vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(response("one"));vi.stubGlobal("fetch",fetcher);
 const client=await import("./client");
 await expect(client.analyseArea(geometry)).rejects.toThrow("offline");expect(created).toHaveLength(0);
 await expect(client.analyseArea(geometry)).resolves.toEqual(result);expect(created).toHaveLength(1);
});
it("ignores an old version response arriving after a newer Space entry",async()=>{
 let resolveOld!:(v:Response)=>void;
 const old=new Promise<Response>(r=>{resolveOld=r;});
 vi.stubGlobal("fetch",vi.fn().mockReturnValueOnce(old).mockResolvedValue(response("two")));
 const client=await import("./client"),first=client.analyseArea(geometry);
 client.invalidateAnalysisVersion();await client.analyseArea(geometry);
 resolveOld(response("one"));await first;
 expect(created).toHaveLength(1);expect(created[0]!.terminate).not.toHaveBeenCalled();
});
