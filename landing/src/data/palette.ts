/**
 * 18 real (anonymized) target colors from the holdout evaluation set.
 *
 * The Lab values are the source of truth (they seed the hero constellation's
 * clusters in CIELAB space); each hex is that Lab value through `labToRgb`,
 * verified exact against the palette shipped on the previous site. These are
 * the only saturated colors permitted on the page besides the case-study
 * swatches — real production dye color, never decorative.
 */

import type { Lab } from "../lib/lab";

export interface PaletteColor {
  lab: Lab;
  hex: string;
}

export const PALETTE: PaletteColor[] = [
  { lab: { l: 35.93, a: 68.94, b: 33.54 }, hex: "#b60024" },
  { lab: { l: 32.95, a: 62.3, b: 22.13 }, hex: "#a4002f" },
  { lab: { l: 40.54, a: 65.55, b: 17.01 }, hex: "#be0747" },
  { lab: { l: 48.51, a: 57.63, b: 3.0 }, hex: "#c94070" },
  { lab: { l: 63.6, a: 32.2, b: -4.42 }, hex: "#cd85a3" },
  { lab: { l: 76.15, a: 21.9, b: 21.4 }, hex: "#efac95" },
  { lab: { l: 70.55, a: 54.55, b: 51.18 }, hex: "#ff7e52" },
  { lab: { l: 71.31, a: 54.93, b: 49.67 }, hex: "#ff8057" },
  { lab: { l: 89.78, a: 14.77, b: 51.1 }, hex: "#ffd580" },
  { lab: { l: 85.29, a: -6.64, b: 6.83 }, hex: "#ced8c8" },
  { lab: { l: 78.82, a: -16.19, b: 10.68 }, hex: "#abcbaf" },
  { lab: { l: 65.16, a: -11.84, b: -13.7 }, hex: "#75a5b6" },
  { lab: { l: 68.13, a: -4.38, b: -23.24 }, hex: "#82aacf" },
  { lab: { l: 94.13, a: 2.84, b: -10.15 }, hex: "#eaedff" },
  { lab: { l: 34.95, a: 12.71, b: -26.49 }, hex: "#4f4d7c" },
  { lab: { l: 37.27, a: 16.68, b: -31.58 }, hex: "#55518b" },
  { lab: { l: 24.26, a: 16.88, b: -19.1 }, hex: "#453256" },
  { lab: { l: 23.51, a: 36.58, b: 4.48 }, hex: "#691a33" },
];
