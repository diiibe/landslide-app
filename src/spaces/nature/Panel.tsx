import { TrekPanel } from "../trek/Panel";
import { useExperienceStore } from "../store";
import { FirePanel } from "./FirePanel";
import { WildlifePanel } from "./WildlifePanel";
import { ParkPanel } from "./ParkPanel";
export function NaturePanel({ tools }: { tools: boolean }) {
  const id = useExperienceStore((s) => s.activeId);
  return id === "trek" ? <TrekPanel tools={tools}/> : id === "fire" ? (
    <FirePanel tools={tools} />
  ) : id === "wildlife" ? (
    <WildlifePanel tools={tools} />
  ) : id === "park" ? (
    <ParkPanel tools={tools} />
  ) : null;
}
