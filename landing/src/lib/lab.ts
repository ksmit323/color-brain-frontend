/**
 * CIELAB → sRGB conversion for on-page color swatches.
 *
 * Ported from the app's Rust implementation (`app/src/components/result_panel.rs`)
 * so every swatch on the landing page matches the product's rendering exactly.
 */

/** A CIELAB color under the D65 illuminant. */
export interface Lab {
  l: number;
  a: number;
  b: number;
}

/**
 * Convert a CIELAB color (D65) to an 8-bit sRGB triple.
 * Out-of-gamut results are clamped per channel, which is acceptable for an
 * indicative swatch.
 */
export function labToRgb(l: number, a: number, b: number): [number, number, number] {
  // Lab -> XYZ.
  const fy = (l + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  const eps = 216 / 24389;
  const kappa = 24389 / 27;
  const inv = (t: number) => (t ** 3 > eps ? t ** 3 : (116 * t - 16) / kappa);
  const xr = inv(fx);
  const yr = l > kappa * eps ? fy ** 3 : l / kappa;
  const zr = inv(fz);
  // D65 reference white.
  const x = xr * 0.95047;
  const y = yr;
  const z = zr * 1.08883;
  // XYZ -> linear sRGB.
  const rl = 3.2406 * x - 1.5372 * y - 0.4986 * z;
  const gl = -0.9689 * x + 1.8758 * y + 0.0415 * z;
  const bl = 0.0557 * x - 0.204 * y + 1.057 * z;
  // Linear -> gamma-encoded sRGB.
  const enc = (c: number) => {
    const clamped = Math.min(Math.max(c, 0), 1);
    const v = clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055;
    return Math.round(v * 255);
  };
  return [enc(rl), enc(gl), enc(bl)];
}

/** Render a Lab value as a CSS `rgb(...)` background color for a swatch. */
export function labToCss(lab: Lab): string {
  const [r, g, b] = labToRgb(lab.l, lab.a, lab.b);
  return `rgb(${r},${g},${b})`;
}
