import { create } from "zustand";
import type { TrekMode, TrekScenario } from "./model";
export const useTrekStore = create<{
  tool: "passages" | "power" | "delivery";
  nodeId: string;
  hours: 6 | 24;
  view: "health" | "passages";
  showRoute: boolean;
  showLinks: boolean;
  scenario: TrekScenario;
}>(() => ({
  tool: "passages",
  nodeId: "st-101",
  hours: 6,
  view: "health",
  showRoute: true,
  showLinks: false,
  scenario: { mode: "normal", since: 0 },
}));
/** Explicit retrospective exercise, never a real network command. */
export function setTrekScenario(mode: TrekMode, time: number) {
  useTrekStore.setState({
    scenario: { mode, since: mode === "normal" ? 0 : time - 20 * 60000 },
  });
}
