//! Shared UI components for the Color Brain app.

mod color;
mod comparison_panel;
mod evidence_panel;
mod history_picker;
mod recipe_table;
mod result_panel;
mod status_indicator;
mod target_form;
mod track_record;

pub use comparison_panel::ComparisonPanel;
pub use evidence_panel::EvidencePanel;
pub use history_picker::HistoryPicker;
pub use recipe_table::RecipeTable;
pub use result_panel::ResultPanel;
pub use status_indicator::StatusIndicator;
pub use target_form::{FormFields, TargetForm};
pub use track_record::TrackRecord;

pub(crate) use color::lab_to_rgb;
