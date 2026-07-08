//! Five real holdout jobs as swatch-comparison cards — data from
//! `color-brain-backend/reports/first_attempt_v1/recommendation_export.csv`, achieved Lab values
//! from `datasets/prepared_dataset.csv` (technician = holdout row achieved; Color Brain = nearest
//! historical row achieved).

use dioxus::prelude::*;

use crate::lab_color::Lab;

/// One anonymized holdout job with target, technician, and Color Brain achieved colors.
#[derive(Clone, Copy, PartialEq)]
pub struct CaseStudy {
    pub row_id: u32,
    pub substrate: &'static str,
    pub target: Lab,
    pub technician: Lab,
    pub color_brain: Lab,
    pub technician_de: f64,
    pub color_brain_de: f64,
    pub improvement: f64,
}

/// The five high-confidence wins called out in LANDING_PAGE_PLAN.md.
pub const CASE_STUDIES: &[CaseStudy] = &[
    CaseStudy {
        row_id: 23_294_442,
        substrate: "PS",
        target: Lab {
            l: 92.987_233_031,
            a: -0.027_770_089_8,
            b: 2.144_529_71,
        },
        technician: Lab {
            l: 93.985_133_04,
            a: -0.418_135_094_8,
            b: 3.068_113_694,
        },
        color_brain: Lab {
            l: 93.297_958_55,
            a: -0.022_022_410_53,
            b: 2.295_344_375,
        },
        technician_de: 1.164,
        color_brain_de: 0.234,
        improvement: 0.930,
    },
    CaseStudy {
        row_id: 23_286_357,
        substrate: "AN",
        target: Lab {
            l: 43.278_151_298,
            a: 5.417_529_427,
            b: -4.510_839_598,
        },
        technician: Lab {
            l: 50.076_841_14,
            a: 4.717_285_418,
            b: -3.324_399_607,
        },
        color_brain: Lab {
            l: 42.849_877_81,
            a: 5.399_599_478,
            b: -3.581_460_632,
        },
        technician_de: 6.706,
        color_brain_de: 0.856,
        improvement: 5.849,
    },
    CaseStudy {
        row_id: 23_307_922,
        substrate: "PC",
        target: Lab {
            l: 63.178_472_192,
            a: 5.786_412_292,
            b: 10.355_558_51,
        },
        technician: Lab {
            l: 64.119_167_18,
            a: 4.929_356_27,
            b: 9.928_536_5,
        },
        color_brain: Lab {
            l: 62.764_169_95,
            a: 5.685_890_459,
            b: 10.483_435_62,
        },
        technician_de: 1.240,
        color_brain_de: 0.390,
        improvement: 0.850,
    },
    CaseStudy {
        row_id: 23_381_315,
        substrate: "EW",
        target: Lab {
            l: 92.442_858_326,
            a: 3.370_245_688,
            b: -10.902_777_766,
        },
        technician: Lab {
            l: 92.586_325_32,
            a: 3.212_452_688,
            b: -9.389_895_772,
        },
        color_brain: Lab {
            l: 92.469_830_12,
            a: 3.308_948_067,
            b: -10.688_752_9,
        },
        technician_de: 1.073,
        color_brain_de: 0.153,
        improvement: 0.921,
    },
    CaseStudy {
        row_id: 23_331_924,
        substrate: "WC",
        target: Lab {
            l: 51.138_265_761,
            a: 11.695_268_889,
            b: -18.960_534_672,
        },
        technician: Lab {
            l: 50.576_050_79,
            a: 11.893_469_89,
            b: -19.280_969_66,
        },
        color_brain: Lab {
            l: 51.138_689_68,
            a: 11.616_737_75,
            b: -18.867_052_34,
        },
        technician_de: 0.593,
        color_brain_de: 0.064,
        improvement: 0.529,
    },
];

/// One swatch column: a color chip, its role label, and an optional ΔE readout.
#[component]
fn Swatch(
    label: String,
    color: String,
    delta_e: Option<f64>,
    #[props(optional)] accent: bool,
) -> Element {
    let de_class = if accent {
        "swatch__de swatch__de--win"
    } else {
        "swatch__de"
    };
    rsx! {
        div { class: "swatch",
            div {
                class: "swatch__chip",
                background_color: "{color}",
            }
            span { class: "swatch__label", "{label}" }
            if let Some(de) = delta_e {
                span { class: "{de_class}", "ΔE {de:.3}" }
            }
        }
    }
}

/// A single case-study card: target vs technician vs Color Brain swatches with ΔE readouts.
#[component]
pub fn CaseStudyCard(study: CaseStudy) -> Element {
    let (tl, ta, tb) = (study.target.l, study.target.a, study.target.b);

    rsx! {
        article { class: "case-card",
            header { class: "case-card__head",
                span { class: "case-card__substrate", "{study.substrate}" }
                span { class: "case-card__id", "Job {study.row_id}" }
                span { class: "case-card__win", "+{study.improvement:.3} ΔE" }
            }
            div { class: "case-card__lab",
                span { b { "L " } "{tl:.2}" }
                span { b { "a " } "{ta:.2}" }
                span { b { "b " } "{tb:.2}" }
            }
            div { class: "case-card__swatches",
                Swatch {
                    label: "Target".to_string(),
                    color: study.target.to_css(),
                    delta_e: None,
                }
                Swatch {
                    label: "Technician".to_string(),
                    color: study.technician.to_css(),
                    delta_e: Some(study.technician_de),
                }
                Swatch {
                    label: "Color Brain".to_string(),
                    color: study.color_brain.to_css(),
                    delta_e: Some(study.color_brain_de),
                    accent: true,
                }
            }
        }
    }
}
