import {expect,it} from 'vitest';
import inside from '@turf/boolean-point-in-polygon';
import {EXPERIENCES} from './experiences';
it('keeps sensors, zone boundaries and routes inside each indicative demonstration site',()=>{
 for(const scene of EXPERIENCES){
  if(!scene.perimeter)continue;
  const paths=[...scene.zones.flatMap(z=>z.geometry.coordinates),...scene.routes.map(r=>r.coordinates),scene.sensors.map(s=>s.coordinates)];
  for(const path of paths){
   for(const p of path)expect(inside(p,scene.perimeter),`${scene.id}: ${p}`).toBe(true);
  }
 }
});
