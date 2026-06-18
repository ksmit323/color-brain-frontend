use dioxus::prelude::*;

use crate::api::{get_health, get_metadata, post_recommendation, RecommendRequest, Recommendation};
use crate::components::{
    EvidencePanel, FormFields, RecipeTable, ResultPanel, StatusIndicator, TargetForm,
};

/// State of a recommendation submit. `Done` is boxed because [`Recommendation`] is large and the
/// state is cloned on each render.
#[derive(Clone)]
enum SubmitState {
    Idle,
    Loading,
    Done(Box<Recommendation>),
    Error(String),
}

/// Build a recommendation request from the form's raw string fields, validating the required
/// numeric inputs. Returns a user-facing error message when a required field is missing or not a
/// number.
#[allow(clippy::too_many_arguments)]
fn build_request(
    target_l: &str,
    target_a: &str,
    target_b: &str,
    substrate: &str,
    dye_prog: &str,
    yarn_weight: &str,
    water_volume: &str,
    liquor_ratio: &str,
    cycle_time: &str,
) -> Result<RecommendRequest, String> {
    let required = |s: &str, name: &str| -> Result<f64, String> {
        s.trim()
            .parse::<f64>()
            .map_err(|_| format!("{name} must be a number"))
    };
    let optional = |s: &str, name: &str| -> Result<Option<f64>, String> {
        match s.trim() {
            "" => Ok(None),
            v => v
                .parse::<f64>()
                .map(Some)
                .map_err(|_| format!("{name} must be a number")),
        }
    };

    let substrate = substrate.trim();
    let dye_prog = dye_prog.trim();
    if substrate.is_empty() {
        return Err("Substrate is required.".into());
    }
    if dye_prog.is_empty() {
        return Err("Dye program is required.".into());
    }

    Ok(RecommendRequest {
        request_id: None,
        target_l: required(target_l, "Target L")?,
        target_a: required(target_a, "Target a")?,
        target_b: required(target_b, "Target b")?,
        substrate: substrate.to_string(),
        dye_prog: dye_prog.to_string(),
        yarn_weight: optional(yarn_weight, "Yarn weight")?,
        water_volume: optional(water_volume, "Water volume")?,
        liquor_ratio: optional(liquor_ratio, "Liquor ratio")?,
        cycle_time: optional(cycle_time, "Cycle time")?,
    })
}

/// The Color Brain first-attempt page: load metadata, enter a target dye job, and show the
/// backend's recommendation.
#[component]
pub fn Home() -> Element {
    // Health drives the connection indicator; metadata loads the form options and summary. Both
    // run once on mount.
    let health = use_resource(move || async move { get_health().await });
    let metadata = use_resource(move || async move { get_metadata().await });

    // Form fields are kept as strings for free-form numeric entry and parsed on submit.
    let fields = FormFields {
        target_l: use_signal(String::new),
        target_a: use_signal(String::new),
        target_b: use_signal(String::new),
        substrate: use_signal(String::new),
        dye_prog: use_signal(String::new),
        yarn_weight: use_signal(String::new),
        water_volume: use_signal(String::new),
        liquor_ratio: use_signal(String::new),
        cycle_time: use_signal(String::new),
    };

    let mut submit_state = use_signal(|| SubmitState::Idle);

    let on_submit = move |event: FormEvent| {
        // Stop the browser's default form submission / page reload.
        event.prevent_default();
        // Read every signal into owned values before spawning the async work; clippy.toml forbids
        // holding signal borrows across `.await`.
        let req = match build_request(
            &fields.target_l.read(),
            &fields.target_a.read(),
            &fields.target_b.read(),
            &fields.substrate.read(),
            &fields.dye_prog.read(),
            &fields.yarn_weight.read(),
            &fields.water_volume.read(),
            &fields.liquor_ratio.read(),
            &fields.cycle_time.read(),
        ) {
            Ok(req) => req,
            Err(msg) => {
                *submit_state.write() = SubmitState::Error(msg);
                return;
            }
        };
        *submit_state.write() = SubmitState::Loading;
        spawn(async move {
            match post_recommendation(&req).await {
                Ok(rec) => *submit_state.write() = SubmitState::Done(Box::new(rec)),
                Err(err) => *submit_state.write() = SubmitState::Error(err),
            }
        });
    };

    // Connection state for the indicator: None while in flight, then reachable / unreachable.
    let online = match health() {
        None => None,
        Some(Ok(_)) => Some(true),
        Some(Err(_)) => Some(false),
    };

    // Recipe column order comes from metadata so the recipe table stays stable across requests.
    let recipe_columns = match metadata() {
        Some(Ok(ref m)) => m.recipe_columns.clone(),
        _ => Vec::new(),
    };

    rsx! {
        div { class: "app",
            header { class: "appbar",
                div { class: "brand",
                    span { class: "brand__mark", "COLOR" b { "BRAIN" } }
                    span { class: "brand__sub", "First-attempt recipe recommender" }
                }
                StatusIndicator { online }
            }

            {match metadata() {
                Some(Ok(meta)) => rsx! {
                    div { class: "metastrip",
                        span { class: "metastrip__item", "Model " span { class: "metastrip__num", "{meta.status}" } }
                        if let Some(rows) = meta.history_rows {
                            span { class: "metastrip__item", span { class: "metastrip__num", "{rows}" } " batches" }
                        }
                        span { class: "metastrip__item", span { class: "metastrip__num", "{meta.known_substrates.len()}" } " substrates" }
                        span { class: "metastrip__item", span { class: "metastrip__num", "{meta.known_dye_programs.len()}" } " programs" }
                        span { class: "metastrip__item", span { class: "metastrip__num", "{meta.recipe_columns.len()}" } " dyes" }
                    }
                },
                Some(Err(_)) => rsx! {
                    div { class: "metastrip metastrip--muted", "Model metadata unavailable" }
                },
                None => rsx! {
                    div { class: "metastrip metastrip--muted", "Loading model metadata…" }
                },
            }}

            main { class: "bench",
                section { class: "panel panel--form",
                    h2 { class: "panel__title", "Target job" }
                    {match metadata() {
                        None => rsx! { p { class: "inline-msg", "Loading metadata…" } },
                        Some(Err(err)) => rsx! {
                            div { class: "inline-msg inline-msg--error",
                                "Could not load model metadata."
                                div { class: "inline-msg__mono", "{err}" }
                            }
                        },
                        Some(Ok(meta)) => rsx! {
                            TargetForm {
                                fields,
                                substrates: meta.known_substrates.clone(),
                                dye_programs: meta.known_dye_programs.clone(),
                                on_submit,
                            }
                        },
                    }}
                }

                div { class: "results",
                    {match submit_state() {
                        SubmitState::Idle => rsx! {
                            div { class: "placeholder", "Enter a target colour and submit to see a recommendation." }
                        },
                        SubmitState::Loading => rsx! {
                            div { class: "inline-msg", "Computing recommendation…" }
                        },
                        SubmitState::Error(err) => rsx! {
                            div { class: "inline-msg inline-msg--error",
                                "Recommendation failed."
                                div { class: "inline-msg__mono", "{err}" }
                            }
                        },
                        SubmitState::Done(rec) => {
                            let recommend = rec.recommendation_action == "recommend";
                            rsx! {
                                ResultPanel { rec: (*rec).clone() }
                                div { class: "result-grid",
                                    if recommend {
                                        RecipeTable { columns: recipe_columns.clone(), recipe: rec.recipe.clone() }
                                    }
                                    EvidencePanel { rec: (*rec).clone() }
                                }
                            }
                        }
                    }}
                }
            }
        }
    }
}
