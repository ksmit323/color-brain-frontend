//! Backend connection status shown in the app bar.

use dioxus::prelude::*;

/// A small pill reporting whether the backend is reachable. `online` is `None` while the health
/// check is in flight, then `Some(true)`/`Some(false)` once it resolves.
#[component]
pub fn StatusIndicator(online: Option<bool>) -> Element {
    let (modifier, label) = match online {
        None => ("connecting", "Connecting…"),
        Some(true) => ("online", "Color Brain ready"),
        Some(false) => ("offline", "Service unavailable"),
    };
    rsx! {
        div { class: "status",
            span { class: "status__dot status__dot--{modifier}" }
            span { class: "status__label", "{label}" }
        }
    }
}
