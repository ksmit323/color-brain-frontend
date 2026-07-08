//! CIELAB → sRGB conversion for on-page color swatches.
//!
//! Ported from `app/src/components/result_panel.rs` — intentional duplication because the landing
//! site is a deliberately independent crate with no shared workspace.

/// A CIELAB color under D65.
#[derive(Clone, Copy, PartialEq)]
pub struct Lab {
    pub l: f64,
    pub a: f64,
    pub b: f64,
}

impl Lab {
    /// Render this Lab value as a CSS `rgb(...)` background color for a swatch chip.
    pub fn to_css(self) -> String {
        let (r, g, b) = lab_to_rgb(self.l, self.a, self.b);
        format!("rgb({r},{g},{b})")
    }
}

/// Convert a CIELAB color (D65 illuminant) to an 8-bit sRGB triple for the on-screen swatch.
/// Out-of-gamut results are clamped per channel, which is acceptable for an indicative swatch.
pub fn lab_to_rgb(l: f64, a: f64, b: f64) -> (u8, u8, u8) {
    // Lab -> XYZ.
    let fy = (l + 16.0) / 116.0;
    let fx = fy + a / 500.0;
    let fz = fy - b / 200.0;
    let eps = 216.0 / 24389.0;
    let kappa = 24389.0 / 27.0;
    let inv = |t: f64| {
        if t.powi(3) > eps {
            t.powi(3)
        } else {
            (116.0 * t - 16.0) / kappa
        }
    };
    let xr = inv(fx);
    let yr = if l > kappa * eps {
        fy.powi(3)
    } else {
        l / kappa
    };
    let zr = inv(fz);
    // D65 reference white.
    let (x, y, z) = (xr * 0.95047, yr, zr * 1.08883);
    // XYZ -> linear sRGB.
    let rl = 3.2406 * x - 1.5372 * y - 0.4986 * z;
    let gl = -0.9689 * x + 1.8758 * y + 0.0415 * z;
    let bl = 0.0557 * x - 0.2040 * y + 1.0570 * z;
    // Linear -> gamma-encoded sRGB.
    let enc = |c: f64| {
        let c = c.clamp(0.0, 1.0);
        let v = if c <= 0.0031308 {
            12.92 * c
        } else {
            1.055 * c.powf(1.0 / 2.4) - 0.055
        };
        (v * 255.0).round() as u8
    };
    (enc(rl), enc(gl), enc(bl))
}
