//! Who It's For: Brands, Suppliers, and Factories — specimen-label cards, not numbered tiles.

use dioxus::prelude::*;

/// One audience card styled as a specimen label (mono role tag, no step numbering).
#[component]
fn Specimen(role: String, tagline: String, body: String) -> Element {
    rsx! {
        div { class: "specimen",
            span { class: "specimen__role", "{role}" }
            p { class: "specimen__tagline", "{tagline}" }
            p { class: "specimen__body", "{body}" }
        }
    }
}

/// The three links in the color chain — brands, suppliers, and factories.
#[component]
pub fn WhoItsFor() -> Element {
    rsx! {
        section { class: "section reveal", id: "who-its-for",
            div { class: "container",
                span { class: "eyebrow", "Who it's for" }
                h2 { class: "section__title",
                    "Every link in the color chain. Covered."
                }
                div { class: "specimens",
                    Specimen {
                        role: "Brands".to_string(),
                        tagline: "Fewer rejected batches. Faster color approvals.".to_string(),
                        body: "You set the standard. Color Brain helps your supply chain hit your color spec on the first attempt — reducing lab dip rounds and getting you to final approval faster.".to_string(),
                    }
                    Specimen {
                        role: "Suppliers".to_string(),
                        tagline: "Hit the brand's spec. Without the guesswork.".to_string(),
                        body: "You win or lose contracts on consistency. Color Brain draws from your production history to recommend recipes more likely to pass first time, cutting rejections before they cost you.".to_string(),
                    }
                    Specimen {
                        role: "Factories".to_string(),
                        tagline: "Less rework. More consistent output at scale.".to_string(),
                        body: "At scale, every first-attempt failure multiplies. Color Brain works across your entire job volume, cutting the rework that eats into your margins.".to_string(),
                    }
                }
            }
        }
    }
}
