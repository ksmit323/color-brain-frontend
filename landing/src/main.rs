use dioxus::prelude::*;

fn main() {
    dioxus::launch(App);
}

/// L1 scaffold spike: proves `landing/` builds and serves standalone, as its own single-crate
/// Cargo project alongside (not inside) the `color-brain-frontend` app. Real content lands in L2+.
#[component]
fn App() -> Element {
    rsx! {
        div {
            h1 { "Color Brain" }
            p { "Landing page scaffold — L1 spike." }
        }
    }
}
