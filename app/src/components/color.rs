//! Shared CIELAB preview conversion for target-color swatches.

/// Convert a CIELAB color under D65 to an indicative 8-bit sRGB preview.
///
/// Monitor previews are not production measurements; out-of-gamut channels are
/// clamped so the UI always has a stable color sample.
pub(crate) fn lab_to_rgb(l: f64, a: f64, b: f64) -> (u8, u8, u8) {
    let fy = (l + 16.0) / 116.0;
    let fx = fy + a / 500.0;
    let fz = fy - b / 200.0;
    let eps = 216.0 / 24389.0;
    let kappa = 24389.0 / 27.0;
    let inverse = |value: f64| {
        if value.powi(3) > eps {
            value.powi(3)
        } else {
            (116.0 * value - 16.0) / kappa
        }
    };

    let x = inverse(fx) * 0.95047;
    let y = if l > kappa * eps {
        fy.powi(3)
    } else {
        l / kappa
    };
    let z = inverse(fz) * 1.08883;

    let linear_r = 3.2406 * x - 1.5372 * y - 0.4986 * z;
    let linear_g = -0.9689 * x + 1.8758 * y + 0.0415 * z;
    let linear_b = 0.0557 * x - 0.2040 * y + 1.0570 * z;
    let encode = |channel: f64| {
        let channel = channel.clamp(0.0, 1.0);
        let encoded = if channel <= 0.0031308 {
            12.92 * channel
        } else {
            1.055 * channel.powf(1.0 / 2.4) - 0.055
        };
        (encoded * 255.0).round() as u8
    };

    (encode(linear_r), encode(linear_g), encode(linear_b))
}
