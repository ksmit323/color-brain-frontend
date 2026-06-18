use dioxus::prelude::*;

use crate::api::{get_metadata, post_recommendation, RecommendRequest, Recommendation};

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
    // Metadata loads once on mount.
    let metadata = use_resource(move || async move { get_metadata().await });

    // Form fields are kept as strings for free-form numeric entry and parsed on submit.
    let mut target_l = use_signal(String::new);
    let mut target_a = use_signal(String::new);
    let mut target_b = use_signal(String::new);
    let mut substrate = use_signal(String::new);
    let mut dye_prog = use_signal(String::new);
    let mut yarn_weight = use_signal(String::new);
    let mut water_volume = use_signal(String::new);
    let mut liquor_ratio = use_signal(String::new);
    let mut cycle_time = use_signal(String::new);

    let mut submit_state = use_signal(|| SubmitState::Idle);

    let on_submit = move |event: FormEvent| {
        // Stop the browser's default form submission / page reload.
        event.prevent_default();
        // Read every signal into owned values before spawning the async work; clippy.toml forbids
        // holding signal borrows across `.await`.
        let req = match build_request(
            &target_l(),
            &target_a(),
            &target_b(),
            &substrate(),
            &dye_prog(),
            &yarn_weight(),
            &water_volume(),
            &liquor_ratio(),
            &cycle_time(),
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

    rsx! {
        h1 { "Color Brain — First Attempt" }

        {match metadata() {
            None => rsx! { p { "Loading metadata…" } },
            Some(Err(err)) => rsx! { p { "Failed to load metadata: {err}" } },
            Some(Ok(meta)) => rsx! {
                form { onsubmit: on_submit,
                    fieldset {
                        legend { "Target color (Lab)" }
                        label { "L " input { value: target_l, oninput: move |e| target_l.set(e.value()) } }
                        label { " a " input { value: target_a, oninput: move |e| target_a.set(e.value()) } }
                        label { " b " input { value: target_b, oninput: move |e| target_b.set(e.value()) } }
                    }
                    fieldset {
                        legend { "Program" }
                        label {
                            "Substrate "
                            select {
                                value: substrate,
                                onchange: move |e| substrate.set(e.value()),
                                option { value: "", "— select —" }
                                for s in &meta.known_substrates {
                                    option { value: "{s}", "{s}" }
                                }
                            }
                        }
                        label {
                            " Dye program "
                            select {
                                value: dye_prog,
                                onchange: move |e| dye_prog.set(e.value()),
                                option { value: "", "— select —" }
                                for p in &meta.known_dye_programs {
                                    option { value: "{p}", "{p}" }
                                }
                            }
                        }
                    }
                    fieldset {
                        legend { "Process variables (optional)" }
                        label { "Yarn weight " input { value: yarn_weight, oninput: move |e| yarn_weight.set(e.value()) } }
                        label { " Water volume " input { value: water_volume, oninput: move |e| water_volume.set(e.value()) } }
                        label { " Liquor ratio " input { value: liquor_ratio, oninput: move |e| liquor_ratio.set(e.value()) } }
                        label { " Cycle time " input { value: cycle_time, oninput: move |e| cycle_time.set(e.value()) } }
                    }
                    button { "Recommend" }
                }
            },
        }}

        {match submit_state() {
            SubmitState::Idle => rsx! {},
            SubmitState::Loading => rsx! { p { "Getting recommendation…" } },
            SubmitState::Error(err) => rsx! { p { "Error: {err}" } },
            SubmitState::Done(rec) => rsx! {
                pre { {format!("{rec:#?}")} }
            },
        }}
    }
}
