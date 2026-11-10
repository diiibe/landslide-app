import { renderHook, act } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useSpaceClock } from "./useClock";
import { useExperienceStore } from "./store";
afterEach(()=>{vi.useRealTimers();useExperienceStore.setState({activeId:null,replayTime:null});});
it("resumes from absolute wall time on visibility return and preserves an intentional replay",()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date("2026-11-10T10:00:00Z"));
 useExperienceStore.setState({activeId:"industry",replayTime:null});
 const {result}=renderHook(()=>useSpaceClock());const before=result.current;
 act(()=>vi.advanceTimersByTime(2000));expect(result.current).toBe(before+2000);
 vi.setSystemTime(new Date("2026-11-10T13:00:00Z"));
 act(()=>window.dispatchEvent(new Event("focus")));expect(result.current).toBe(Date.now());
 act(()=>useExperienceStore.setState({replayTime:before}));
 act(()=>vi.advanceTimersByTime(5000));expect(result.current).toBe(before);
 act(()=>useExperienceStore.setState({replayTime:null}));expect(result.current).toBe(Date.now());
});
