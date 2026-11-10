import { useExperienceStore } from "../store";
import { FirePanel } from "./FirePanel";
import { WildlifePanel } from "./WildlifePanel";
import { ParkPanel } from "./ParkPanel";
export function NaturePanel({ tools }: { tools: boolean }) {
  const id = useExperienceStore((s) => s.activeId);
  return id === "fire" ? (
    <FirePanel tools={tools} />
  ) : id === "wildlife" ? (
    <WildlifePanel tools={tools} />
  ) : id === "park" ? (
    <ParkPanel tools={tools} />
  ) : null;
}
