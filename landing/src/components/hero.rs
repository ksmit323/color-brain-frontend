//! The hero: a "Color Burst" — real production dye colors radiating outward in concentric rings
//! from a single point, instead of a decorative gradient wash. See ../../LANDING_PAGE_PLAN.md.

use dioxus::prelude::*;

/// 18 real (anonymized) target colors from the holdout evaluation set, converted from Lab via
/// the same `lab_to_rgb` math in `crate::lab_color` (precomputed here since the burst is a
/// static composition, not per-chip DOM nodes reading live data). Source Lab values: (35.93,
/// 68.94,33.54) (32.95,62.30,22.13) (40.54,65.55,17.01) (48.51,57.63,3.00) (63.60,32.20,-4.42)
/// (76.15,21.90,21.40) (70.55,54.55,51.18) (71.31,54.93,49.67) (89.78,14.77,51.10)
/// (85.29,-6.64,6.83) (78.82,-16.19,10.68) (65.16,-11.84,-13.70) (68.13,-4.38,-23.24)
/// (94.13,2.84,-10.15) (34.95,12.71,-26.49) (37.27,16.68,-31.58) (24.26,16.88,-19.10)
/// (23.51,36.58,4.48).
const PALETTE: &[&str] = &[
    "#b60024", "#ff7e52", "#4f4d7c", "#ffd580", "#75a5b6", "#c94070", "#abcbaf", "#691a33",
    "#82aacf", "#be0747", "#ced8c8", "#453256", "#ff8057", "#cd85a3", "#eaedff", "#a4002f",
    "#55518b", "#efac95",
];

/// The burst's origin, as a percentage of the hero box.
const ORIGIN: (f64, f64) = (76.0, 40.0);

/// One ring of the burst: `count` blobs spaced evenly around the origin, each `size`px wide.
struct Ring {
    count: usize,
    radius: f64,
    size: f64,
    opacity: f64,
    blur: f64,
    palette_offset: usize,
}

const RINGS: &[Ring] = &[
    // Core — closest, largest, brightest.
    Ring {
        count: 5,
        radius: 55.0,
        size: 190.0,
        opacity: 0.92,
        blur: 30.0,
        palette_offset: 0,
    },
    // Mid ring.
    Ring {
        count: 8,
        radius: 150.0,
        size: 108.0,
        opacity: 0.62,
        blur: 24.0,
        palette_offset: 4,
    },
    // Outer sparks — smallest, faintest, fading into the dark.
    Ring {
        count: 13,
        radius: 275.0,
        size: 44.0,
        opacity: 0.38,
        blur: 14.0,
        palette_offset: 9,
    },
];

/// Deterministic jitter so the rings look hand-scattered, not mechanically even. Same finalizer
/// as used elsewhere in this codebase for stable pseudo-random layout (see git history) — small
/// sequential seeds need a full avalanche or neighboring values barely move.
fn jitter(seed: usize) -> f64 {
    let mut x = (seed as u64).wrapping_add(0x9E37_79B9_7F4A_7C15);
    x = (x ^ (x >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
    x = (x ^ (x >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
    x ^= x >> 31;
    (x % 1000) as f64 / 1000.0
}

#[component]
pub fn Hero() -> Element {
    let mut seed = 0usize;
    let mut blobs = Vec::new();
    for ring in RINGS {
        for i in 0..ring.count {
            let angle_deg = (i as f64 / ring.count as f64) * 360.0 + (jitter(seed) - 0.5) * 22.0;
            let radius = ring.radius * (0.88 + jitter(seed + 1) * 0.24);
            let angle = angle_deg.to_radians();
            let dx = radius * angle.cos();
            let dy = radius * angle.sin();
            let color = PALETTE[(ring.palette_offset + i) % PALETTE.len()];
            let style = format!(
                "--blob-i: {}; left: calc({}% + {dx:.1}px); top: calc({}% + {dy:.1}px); \
                 width: {}px; height: {}px; \
                 background: radial-gradient(circle, {color} 0%, transparent 72%); opacity: {}; \
                 filter: blur({}px);",
                seed, ORIGIN.0, ORIGIN.1, ring.size, ring.size, ring.opacity, ring.blur,
            );
            blobs.push(style);
            seed += 2;
        }
    }

    rsx! {
        section { class: "hero", id: "hero",
            div { class: "color-burst", "aria-hidden": "true",
                for style in blobs {
                    div { class: "color-burst__blob", style: "{style}" }
                }
            }
            div { class: "hero__scrim" }

            div { class: "container hero__content",
                span { class: "eyebrow", "12,398 real dye jobs" }
                h1 { class: "hero__headline", "The recipe already exists. We find it." }
                p { class: "hero__subhead",
                    "Color Brain matches new colors to proven recipes in your own dye history — and stays quiet when it isn't sure."
                }
                div { class: "hero__stats",
                    div { class: "stat",
                        span { class: "stat__value", "86.7%" }
                        span { class: "stat__label", "win rate on recommendations" }
                    }
                    div { class: "stat",
                        span { class: "stat__value", "2,043" }
                        span { class: "stat__label", "unseen holdout jobs" }
                    }
                }
            }
        }
    }
}
