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
        section { class: "panel",
            h2 { class: "panel__title", "Recipe" }
            if rows.is_empty() {
                p { class: "evidence__empty", "No dye amounts were returned for this job." }
            } else {
                for (dye, amount) in rows {
                    div { class: "recipe__row",
                        span { class: "recipe__dye", "{dye}" }
                        span { class: "recipe__amount", "{amount:.3}" }
                    }
                }
            }
        }
    }
}
