use dioxus::prelude::*;

use crate::api::{
    get_health, get_history, get_metadata, get_replay, post_recommendation, HistoryResponse,
    RecommendRequest, Recommendation, ReplayDetail,
};
use crate::components::{
    ComparisonPanel, EvidencePanel, FormFields, HistoryPicker, RecipeTable, ResultPanel,
    StatusIndicator, TargetForm, TrackRecord,
};

/// State of a recommendation submit. `Done` is boxed because [`Recommendation`] is large and the
/// state is cloned on each render.
#[derive(Clone)]
enum SubmitState {
    Idle,
    Loading,
    Done(Box<Recommendation>),
    ValidationError(String),
    Error(String),
}

/// State of a replay fetch, mirroring [`SubmitState`]. `Done` is boxed for the same reason.
#[derive(Clone)]
enum ReplayState {
    Idle,
    Loading,
    Done(Box<ReplayDetail>),
    Error(String),
}

/// Which result the shared results column is showing. The live form and the replay picker each
/// drive their own state; the most recent action decides what renders.
#[derive(Clone, Copy, PartialEq)]
enum ActiveView {
    Live,
    Replay,
}

/// Replay picker disabled for demo until `GET /first-attempt/history` is wired up.
const SHOW_REPLAY_PANEL: bool = false;

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
    let required = |s: &str, name: &str, min: f64, max: f64| -> Result<f64, String> {
        let value = s
            .trim()
            .parse::<f64>()
            .map_err(|_| format!("Enter {name} as a number between {min} and {max}."))?;
        if !(min..=max).contains(&value) {
            return Err(format!("{name} must be between {min} and {max}."));
        }
        Ok(value)
    };
    let optional = |s: &str, name: &str| -> Result<Option<f64>, String> {
        match s.trim() {
            "" => Ok(None),
            value => {
                let value = value
                    .parse::<f64>()
                    .map_err(|_| format!("{name} must be a number greater than zero."))?;
                if value <= 0.0 {
                    return Err(format!("{name} must be greater than zero."));
                }
                Ok(Some(value))
            }
        }
    };

    let substrate = substrate.trim();
    let dye_prog = dye_prog.trim();
    if substrate.is_empty() {
        return Err("Select a substrate.".into());
    }
    if dye_prog.is_empty() {
        return Err("Select a dye program.".into());
    }

    Ok(RecommendRequest {
        request_id: None,
        target_l: required(target_l, "Target L*", 0.0, 100.0)?,
        target_a: required(target_a, "Target a*", -128.0, 127.0)?,
        target_b: required(target_b, "Target b*", -128.0, 127.0)?,
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
    let history = use_resource(move || async move {
        if !SHOW_REPLAY_PANEL {
            return Ok(HistoryResponse { jobs: vec![] });
        }
        get_history().await
    });

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
    let mut replay_state = use_signal(|| ReplayState::Idle);
    let mut selected_row_id = use_signal(|| Option::<String>::None);
    let mut active_view = use_signal(|| ActiveView::Live);

    // Results render below the form on narrow screens. Bring the decision into
    // view after a completed request without disturbing the desktop layout.
    use_effect(move || {
        let should_reveal = matches!(
            &*submit_state.read(),
            SubmitState::Done(_) | SubmitState::Error(_)
        );
        if should_reveal {
            spawn(async move {
                let _ = document::eval(
                    r#"
                    if (window.matchMedia("(max-width: 900px)").matches) {
                        const heading = document.getElementById("result-heading");
                        heading?.scrollIntoView({ behavior: "smooth", block: "start" });
                        heading?.focus({ preventScroll: true });
                    }
                    "#,
                )
                .await;
            });
        }
    });

    let on_submit = move |event: FormEvent| {
        // Stop the browser's default form submission / page reload.
        event.prevent_default();
        // A live submit takes over the shared results column.
        *active_view.write() = ActiveView::Live;
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
                *submit_state.write() = SubmitState::ValidationError(msg);
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

    // Backtest headline (win rate / median improvement), shown on the picker and live recommendations.
    let comparison_stats = match metadata() {
        Some(Ok(ref m)) => m.comparison_stats.clone(),
        _ => None,
    };
    let submitting = matches!(&*submit_state.read(), SubmitState::Loading);
    let validation_error = match &*submit_state.read() {
        SubmitState::ValidationError(message) => Some(message.clone()),
        _ => None,
    };

    rsx! {
        div { class: "app",
            header { class: "appbar",
                div { class: "brand",
                    span { class: "brand__mark", "COLOR" b { "BRAIN" } }
                    span { class: "brand__sub", "Historical recipe decision support" }
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
                        span { class: "metastrip__item", span { class: "metastrip__num", "{meta.known_dye_programs.len()}" } " dye programs" }
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
                div { class: "bench__col",
                    section { class: "panel panel--form",
                        p { class: "panel__eyebrow", "Step 1 · Job setup" }
                        h1 { class: "form__title", "Enter the target job" }
                        p { class: "form__intro",
                            "Use the measured target and production context from the job ticket."
                        }
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
                                    dye_programs: meta.dye_programs_chronological(),
                                    submitting,
                                    backend_online: online,
                                    validation_error: validation_error.clone(),
                                    on_submit,
                                }
                            },
                        }}
                    }

                    if SHOW_REPLAY_PANEL {
                        {match history() {
                            Some(Ok(resp)) => rsx! {
                                HistoryPicker {
                                    jobs: resp.jobs.clone(),
                                    stats: comparison_stats.clone(),
                                    selected: selected_row_id(),
                                    on_select: move |row_id: String| {
                                        // A replay selection takes over the shared results column.
                                        *active_view.write() = ActiveView::Replay;
                                        *selected_row_id.write() = Some(row_id.clone());
                                        *replay_state.write() = ReplayState::Loading;
                                        spawn(async move {
                                            match get_replay(&row_id).await {
                                                Ok(detail) => {
                                                    *replay_state.write() =
                                                        ReplayState::Done(Box::new(detail))
                                                }
                                                Err(err) => {
                                                    *replay_state.write() = ReplayState::Error(err)
                                                }
                                            }
                                        });
                                    },
                                }
                            },
                            Some(Err(err)) => rsx! {
                                section { class: "panel",
                                    h2 { class: "panel__title", "Replay a past job" }
                                    div { class: "inline-msg inline-msg--error",
                                        "Could not load past jobs."
                                        div { class: "inline-msg__mono", "{err}" }
                                    }
                                }
                            },
                            None => rsx! {
                                section { class: "panel",
                                    h2 { class: "panel__title", "Replay a past job" }
                                    p { class: "inline-msg", "Loading past jobs…" }
                                }
                            },
                        }}
                    }
                }

                div { class: "results", id: "results", aria_live: "polite",
                    {match active_view() {
                        ActiveView::Live => match submit_state() {
                            SubmitState::Idle => rsx! {
                                div { class: "placeholder",
                                    span { class: "placeholder__step", "01" }
                                    h2 { "Start with the target job" }
                                    p {
                                        "Enter the measured Lab color, substrate, and dye program. "
                                        "Color Brain will search compatible production history."
                                    }
                                    ol { class: "placeholder__flow",
                                        li { "Validate the target" }
                                        li { "Search proven batches" }
                                        li { "Return a recipe or a clear no-match" }
                                    }
                                }
                            },
                            SubmitState::Loading => rsx! {
                                div { class: "loading-state", role: "status",
                                    span { class: "loading-state__spinner", aria_hidden: "true" }
                                    div {
                                        h2 { "Searching production history" }
                                        p { "Comparing this target with compatible jobs and checking the confidence gate." }
                                    }
                                }
                            },
                            SubmitState::ValidationError(_) => rsx! {
                                div { class: "placeholder placeholder--compact",
                                    h2 { "Check the target job" }
                                    p { "Correct the highlighted form entry, then try again." }
                                }
                            },
                            SubmitState::Error(err) => rsx! {
                                div { class: "inline-msg inline-msg--error",
                                    strong { "Color Brain could not complete the recommendation." }
                                    p { "Your entries are unchanged. Check the connection and try again." }
                                    div { class: "inline-msg__mono", "{err}" }
                                }
                            },
                            SubmitState::Done(rec) => {
                                let recommend = rec.recommendation_action == "recommend";
                                rsx! {
                                    ResultPanel { rec: (*rec).clone() }
                                    if recommend {
                                        RecipeTable { columns: recipe_columns.clone(), recipe: rec.recipe.clone() }
                                    }
                                    details { class: "explanation", open: !recommend,
                                        summary {
                                            span {
                                                if recommend {
                                                    "Why this recipe was selected"
                                                } else {
                                                    "Why no recipe was recommended"
                                                }
                                            }
                                            small { "Source batch, target distance, and model evidence" }
                                        }
                                        div { class: "explanation__body",
                                            EvidencePanel { rec: (*rec).clone() }
                                            if recommend {
                                                if let Some(stats) = comparison_stats.clone() {
                                                    div { class: "panel panel--track",
                                                        h2 { class: "panel__title", "Model track record" }
                                                        TrackRecord { stats }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        ActiveView::Replay => match replay_state() {
                            ReplayState::Idle => rsx! {
                                div { class: "placeholder", "Pick a past job to see how Color Brain compares." }
                            },
                            ReplayState::Loading => rsx! {
                                div { class: "inline-msg", "Loading comparison…" }
                            },
                            ReplayState::Error(err) => rsx! {
                                div { class: "inline-msg inline-msg--error",
                                    "Could not load comparison."
                                    div { class: "inline-msg__mono", "{err}" }
                                }
                            },
                            ReplayState::Done(detail) => {
                                let recommend = detail.recommendation_action == "recommend";
                                let rec: Recommendation = (*detail).clone().into();
                                rsx! {
                                    ComparisonPanel { detail: (*detail).clone() }
                                    ResultPanel { rec: rec.clone() }
                                    if recommend {
                                        RecipeTable { columns: recipe_columns.clone(), recipe: detail.recipe.clone() }
                                    }
                                    details { class: "explanation", open: true,
                                        summary {
                                            span { "Evidence for this replay" }
                                            small { "Source batch and target distance" }
                                        }
                                        div { class: "explanation__body",
                                            EvidencePanel { rec }
                                        }
                                    }
                                }
                            }
                        },
                    }}
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::build_request;

    fn valid_request(liquor_ratio: &str) -> Result<crate::api::RecommendRequest, String> {
        build_request(
            "52.4",
            "18.1",
            "-7.2",
            "Cotton",
            "P3",
            "250",
            "2500",
            liquor_ratio,
            "60",
        )
    }

    #[test]
    fn accepts_numeric_liquor_ratio() {
        let request = valid_request("10").expect("numeric liquor ratio should be valid");
        assert_eq!(request.liquor_ratio, Some(10.0));
    }

    #[test]
    fn rejects_out_of_range_lab_coordinates() {
        let result = build_request("101", "0", "0", "Cotton", "P3", "", "", "", "");
        assert!(result.is_err_and(|message| message.contains("between 0 and 100")));
    }

    #[test]
    fn rejects_formatted_liquor_ratio() {
        let result = valid_request("1:10");
        assert!(result.is_err_and(|message| message.contains("greater than zero")));
    }
}
