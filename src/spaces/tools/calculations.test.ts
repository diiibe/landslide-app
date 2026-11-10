import { describe, expect, it } from "vitest";
import { EXPERIENCES } from "../experiences";
import { NORMAL, TIME, presence } from "../simulation";
import { energyReport, integral, irrigationReport, mountainReport, retailReport, trafficReport } from "./calculations";
const get=(id:string)=>EXPERIENCES.find(s=>s.id===id)!;
const t=Date.parse("2026-11-10T10:00:00Z");
describe("space decision tools",()=>{
 it("integrates power over elapsed hours and never converts PV exports into negative purchase",()=>{
  expect(integral([{time:0,value:100},{time:TIME.HOUR,value:100},{time:2*TIME.HOUR,value:100}])).toBe(200);
  const baseline=energyReport(get("industry"),t,6,NORMAL,0,.25);
  expect(baseline.planned).toBe(baseline.imported);
  const proposal=energyReport(get("industry"),t,6,NORMAL,20,.25);
  expect(proposal.planned).toBeLessThan(proposal.imported);
  expect(proposal.cost-proposal.proposedCost).toBeCloseTo(proposal.saved*.25);
  const solar=energyReport(get("industry"),t,6,NORMAL,20,.25,"solar");
  expect(solar.imported).toBe(0);
  expect(solar.planned).toBe(0);
 });
 it("balances soil deficit, efficiency, rain and reserve in compatible volume units",()=>{
  const site=get("vineyard"),a=irrigationReport(site,t,NORMAL,40,30,50,0,0),b=irrigationReport(site,t,NORMAL,40,60,50,0,0);
  expect(a.zones.length).toBe(2);
  expect(a.gross).toBeCloseTo(a.net*2);
  expect(b.gross).toBeCloseTo(a.gross*2);
  expect(a.shortfall).toBe(a.gross);
  expect(irrigationReport(site,t,NORMAL,40,30,50,20,300).gross).toBeLessThan(a.gross);
  expect(irrigationReport(site,t,NORMAL,10,30,85,0,50).gross).toBe(0);
 });
 it("uses zone occupancy instead of adding entry gates and reports a zero night-time staff need",()=>{
  const site=get("retail"),r=retailReport(site,t,NORMAL,"all",60,4,6);
  expect(r.current).toBe(presence(site,t));
  expect(r.zones.reduce((s,z)=>s+z.people,0)).toBe(r.current);
  expect(r.staffNow).toBe(Math.ceil(r.current/60));
  const night=retailReport(site,Date.parse("2026-11-10T02:00:00Z"),NORMAL,"all",60,4,1);
  expect(night.current).toBe(0);expect(night.staffNow).toBe(0);
 });
 it("preserves the same road model at 100%, and a capacity reduction cannot improve its speed or queue",()=>{
  for(const scenario of [NORMAL,{id:"rain" as const,since:t-TIME.HOUR}]) {
   const same=trafficReport(get("traffic"),t,scenario,0,100,6),reduced=trafficReport(get("traffic"),t,scenario,0,50,6);
   expect(same.after.speed).toBe(same.before.speed);expect(same.after.queue).toBe(same.before.queue);
   expect(reduced.after.speed).toBeLessThanOrEqual(reduced.before.speed);
   expect(reduced.after.queue).toBeGreaterThanOrEqual(reduced.before.queue);
   expect(reduced.minutesAfter).toBeGreaterThanOrEqual(reduced.minutesBefore);
  }
 });
 it("conserves every offered visitor: quota defers access rather than hiding people, including a stopped lift",()=>{
  const site=get("mountain"),scenario={id:"rain" as const,since:t-TIME.HOUR};
  const r=mountainReport(site,t,scenario,50,100);
  expect(r.offered).toBeCloseTo(r.admitted+r.deferred);
  expect(r.admitted).toBeCloseTo(r.served+r.queue);
  expect(r.deferred).toBeGreaterThan(0);
  expect(r.baseline).toHaveLength(25);
  for(const count of [r.offered,r.admitted,r.deferred,r.served,r.queue])expect(Number.isInteger(count)).toBe(true);
  const low=mountainReport(site,t,NORMAL,100,100),high=mountainReport(site,t,NORMAL,100,1200);
  expect(high.queue).toBeLessThanOrEqual(low.queue);
  expect(low.baseline).toEqual(high.baseline);
 });
 it("remains finite over day/night, every scenario, and the 25-hour Rome clock change",()=>{
  function finite(x:unknown):void {if(typeof x==="number")expect(Number.isFinite(x)).toBe(true);else if(x&&typeof x==="object")for(const v of Object.values(x))finite(v);}
  for(const at of [t,t-12*TIME.HOUR,Date.parse("2026-10-25T01:30:00Z")])for(const id of ["normal","peak","rain","efficient"] as const) {
   const s={id,since:at-TIME.HOUR};
   finite(energyReport(get("industry"),at,24,s,15,.25));finite(irrigationReport(get("vineyard"),at,s,30,30,85,5,50));
   finite(retailReport(get("retail"),at,s,"all",60,4,6));finite(trafficReport(get("traffic"),at,s,0,50,6));finite(mountainReport(get("mountain"),at,s,70,500));
  }
 });
});
