/** Explicit class selection; minClass remains readable for saved legacy views. */
export interface LandslideStyle {
  minClass: number;
  classes?: number[] | undefined;
  opacity: number;
}
export const LANDSLIDE_CLASSES = [1, 2, 3, 4, 5] as const;
export const selectedClasses = (style: LandslideStyle, count = 5): number[] =>
  [...new Set(style.classes ?? LANDSLIDE_CLASSES.filter(c => c >= style.minClass))]
    .filter(c => Number.isInteger(c) && c >= 1 && c <= count).sort((a, b) => a - b);
export const classSelectionText = (classes: number[]) =>
  classes.length ? `Classi ${classes.join(", ")}` : "Nessuna classe visibile";
export function withClasses(style: LandslideStyle, classes: number[]): LandslideStyle {
  const chosen = selectedClasses({ ...style, classes });
  return { ...style, classes: chosen, minClass: chosen[0] ?? 1 };
}
export const classSum = (values: number[], classes: number[], offset = 1) =>
  classes.reduce((sum, c) => sum + (values[c - offset] ?? 0), 0);
