//! Replay picker: the past dye jobs the model was scored on, each a click away from a
//! technician-vs-Color-Brain comparison.

use dioxus::prelude::*;

use crate::api::ReplayJob;

/// A single selectable job row: its batch id and program, plus a compact win/loss badge. Clicking
/// emits the `row_id` so the parent can fetch and show the full comparison. Kept private, like
/// `Field` in the target form.
#[component]
fn ReplayRow(job: ReplayJob, selected: bool, on_select: EventHandler<String>) -> Element {
    let row_id = job.row_id.clone();
    let row_class = if selected {
        "replay-list__row replay-list__row--selected"
    } else {
        "replay-list__row"
    };
    // The badge reads the outcome at a glance; `None` means Color Brain had no comparable history.
    let (badge_mod, badge_text) = match job.win {
        Some(true) => ("win", "WIN"),
        Some(false) => ("loss", "LOSS"),
        None => ("abstain", "—"),
    };

    rsx! {
        button {
            r#type: "button",
            class: "{row_class}",
            onclick: move |_| on_select.call(row_id.clone()),
            div { class: "replay-list__meta",
                span { class: "replay-list__id", "{job.row_id}" }
                span { class: "replay-list__sub", "{job.substrate} · {job.dye_prog}" }
            }
            span { class: "win-badge win-badge--{badge_mod}", "{badge_text}" }
        }
    }
}

/// The list of replayable past jobs. `selected` is the currently open job (for highlighting);
/// `on_select` fires with the chosen `row_id`.
#[component]
pub fn HistoryPicker(
    jobs: Vec<ReplayJob>,
    selected: Option<String>,
    on_select: EventHandler<String>,
) -> Element {
    rsx! {
        section { class: "panel",
            h2 { class: "panel__title", "Replay a past job" }
            p { class: "replay-hint",
                "Pick a job a technician already ran to see how Color Brain compares."
            }
            if jobs.is_empty() {
                p { class: "evidence__empty", "No past jobs are available to replay." }
            } else {
                div { class: "replay-list",
                    for job in jobs {
                        ReplayRow {
                            key: "{job.row_id}",
                            selected: selected.as_deref() == Some(job.row_id.as_str()),
                            job: job.clone(),
                            on_select,
                        }
                    }
                }
            }
        }
    }
}
