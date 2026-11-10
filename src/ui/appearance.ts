import { create } from "zustand";

export const PALETTES = [
  {
    id: "forest",
    name: "Bosco",
    description: "Verdi minerali",
    swatches: ["#f1f7f2", "#d0dbd1", "#7d8f80", "#24522f"],
  },
  {
    id: "lagoon",
    name: "Laguna",
    description: "Toni di costa",
    swatches: ["#eff7f9", "#cbdbdf", "#758e95", "#1c515f"],
  },
  {
    id: "earth",
    name: "Terra",
    description: "Sabbia e argilla",
    swatches: ["#faf4f0", "#e2d5cd", "#988579", "#6a3c1b"],
  },
  {
    id: "graphite",
    name: "Grafite",
    description: "Neutri essenziali",
    swatches: ["#f4f4fa", "#d6d6e3", "#87879b", "#464653"],
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
