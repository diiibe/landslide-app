import { create } from "zustand";

export const PALETTES = [
  {
    id: "forest",
    name: "Bosco",
    description: "Verdi minerali",
    swatches: ["#f4f6f2", "#d2ddcc", "#789871", "#2f5d3a"],
  },
  {
    id: "lagoon",
    name: "Laguna",
    description: "Toni di costa",
    swatches: ["#f0f6f6", "#cfdfdf", "#658e97", "#285c6a"],
  },
  {
    id: "earth",
    name: "Terra",
    description: "Sabbia e argilla",
    swatches: ["#f8f4ef", "#e2d5c6", "#b68c68", "#815131"],
  },
  {
    id: "graphite",
    name: "Grafite",
    description: "Neutri essenziali",
    swatches: ["#f4f4f5", "#d9d9de", "#90909a", "#51515e"],
  },
] as const;
export type Palette = (typeof PALETTES)[number]["id"];
type Preferences = { palette: Palette; motion: boolean };
const KEY = "fvg:appearance";
export function readAppearance(): Preferences {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return {
      palette: PALETTES.some((p) => p.id === value?.palette)
        ? value.palette
        : "forest",
      motion: typeof value?.motion === "boolean" ? value.motion : true,
    };
  } catch {
    return { palette: "forest", motion: true };
  }
}
function apply(preferences: Preferences) {
  if (typeof document !== "undefined") {
    document.documentElement.dataset.palette = preferences.palette;
    document.documentElement.dataset.motion = preferences.motion
      ? "full"
      : "reduced";
  }
}
function save(preferences: Preferences) {
  apply(preferences);
  try {
    localStorage.setItem(KEY, JSON.stringify(preferences));
  } catch {
    /* Session preferences still work when storage is unavailable. */
  }
}
const initial = readAppearance();
apply(initial);
export const useAppearance = create<
  Preferences & {
    setPalette: (palette: Palette) => void;
    setMotion: (motion: boolean) => void;
  }
>((set, get) => ({
  ...initial,
  setPalette: (palette) => {
    if (!PALETTES.some((p) => p.id === palette)) return;
    save({ palette, motion: get().motion });
    set({ palette });
  },
  setMotion: (motion) => {
    save({ palette: get().palette, motion });
    set({ motion });
  },
}));
