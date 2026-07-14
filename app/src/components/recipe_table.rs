//! The recommended recipe: dye amounts in the model's stable column order.

use std::collections::HashMap;

use dioxus::prelude::*;

/// List the dyes the recipe actually doses. Rows are taken in `columns` order (metadata's
/// `recipe_columns`) so ordering is stable across requests, but the many dyes left at zero are
/// dropped — a recipe is the dyes in the mix, not the full inventory.
#[component]
pub fn RecipeTable(columns: Vec<String>, recipe: HashMap<String, f64>) -> Element {
    let rows: Vec<(String, f64)> = columns
        .into_iter()
        .filter_map(|dye| {
            let amount = recipe.get(&dye).copied().unwrap_or(0.0);
            (amount != 0.0).then_some((dye, amount))
        })
        .collect();

    rsx! {
        section { class: "panel panel--recipe",
            div { class: "panel__heading",
                div {
                    p { class: "panel__eyebrow", "Action" }
                    h2 { class: "panel__title panel__title--primary", "Recommended recipe" }
                }
                if !rows.is_empty() {
                    span { class: "recipe__count", "{rows.len()} dyes" }
                }
            }
            if rows.is_empty() {
                p { class: "evidence__empty", "No dye amounts were returned for this job." }
            } else {
                p { class: "recipe__intro",
                    "Use the proven dye combination below as the starting formula for this job."
                }
                table { class: "recipe__table",
                    thead {
                        tr {
                            th { scope: "col", "Dye" }
                            th { scope: "col", "Recorded amount" }
                        }
                    }
                    tbody {
                        for (dye, amount) in rows {
                            tr { key: "{dye}",
                                td { class: "recipe__dye", "{dye}" }
                                td { class: "recipe__amount", "{amount:.3}" }
                            }
                        }
                    }
                }
                p { class: "recipe__basis",
                    "Amounts use the dosing basis recorded by the source production system."
                }
            }
        }
    }
}
