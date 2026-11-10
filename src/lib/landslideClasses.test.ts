import {expect,it} from "vitest";
import {classSum,selectedClasses,withClasses} from "./landslideClasses";
it("uses explicit visibility, keeps empty visibility and understands saved cumulative thresholds",()=>{
 expect(selectedClasses({minClass:4,opacity:.45})).toEqual([4,5]);
 expect(selectedClasses({minClass:1,classes:[],opacity:.45})).toEqual([]);
 expect(withClasses({minClass:4,opacity:.3},[5,2,2,9]).classes).toEqual([2,5]);
});
it("sums only selected classes with different area and network bin offsets",()=>{
 expect(classSum([10,20,30,40,50],[2,5])).toBe(70);
 expect(classSum([99,10,20,30,40,50],[2,5],0)).toBe(70);
 expect(classSum([10,20,30,40,50],[])).toBe(0);
});
