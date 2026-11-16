import type { UserPolygon } from "@/app/types";
import type { SpaceId } from "./types";
export const SPACE_IDS: SpaceId[] = ["landslides", "industry", "vineyard", "retail", "traffic", "mountain", "fire", "wildlife", "park", "trek"];
export const parseAreaSpace = (value: unknown): SpaceId | null => typeof value === "string" && SPACE_IDS.includes(value as SpaceId) ? value as SpaceId : null;
export const areaInSpace = (area: Pick<UserPolygon, "spaceId">, space: SpaceId | null) => (area.spaceId ?? null) === space;
export const formatArea = (km2: number) => km2 < .01 ? `${(km2 * 1e6).toLocaleString("it-IT", { maximumSignificantDigits: 3 })} m²` : `${km2.toLocaleString("it-IT", { maximumSignificantDigits: 3 })} km²`;
