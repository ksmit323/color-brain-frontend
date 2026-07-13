/**
 * Five real holdout jobs shown as swatch comparisons — data from
 * `color-brain-backend/reports/first_attempt_v1/recommendation_export.csv`,
 * achieved Lab values from `datasets/prepared_dataset.csv` (technician =
 * holdout row achieved; Color Brain = nearest historical row achieved).
 */

import type { Lab } from "../lib/lab";

/** First-attempt ΔE above this threshold counts as missing the color spec. */
export const TECHNICIAN_FAIL_DE = 1.0;

/** One anonymized holdout job with target, technician, and Color Brain achieved colors. */
export interface CaseStudy {
  rowId: number;
  substrate: string;
  target: Lab;
  technician: Lab;
  colorBrain: Lab;
  technicianDe: number;
  colorBrainDe: number;
  improvement: number;
}

export const CASE_STUDIES: CaseStudy[] = [
  {
    rowId: 23294442,
    substrate: "PS",
    target: { l: 92.987233031, a: -0.0277700898, b: 2.14452971 },
    technician: { l: 93.98513304, a: -0.4181350948, b: 3.068113694 },
    colorBrain: { l: 93.29795855, a: -0.02202241053, b: 2.295344375 },
    technicianDe: 1.164,
    colorBrainDe: 0.234,
    improvement: 0.93,
  },
  {
    rowId: 23286357,
    substrate: "AN",
    target: { l: 43.278151298, a: 5.417529427, b: -4.510839598 },
    technician: { l: 50.07684114, a: 4.717285418, b: -3.324399607 },
    colorBrain: { l: 42.84987781, a: 5.399599478, b: -3.581460632 },
    technicianDe: 6.706,
    colorBrainDe: 0.856,
    improvement: 5.849,
  },
  {
    rowId: 23307922,
    substrate: "PC",
    target: { l: 63.178472192, a: 5.786412292, b: 10.35555851 },
    technician: { l: 64.11916718, a: 4.92935627, b: 9.9285365 },
    colorBrain: { l: 62.76416995, a: 5.685890459, b: 10.48343562 },
    technicianDe: 1.24,
    colorBrainDe: 0.39,
    improvement: 0.85,
  },
  {
    rowId: 23381315,
    substrate: "EW",
    target: { l: 92.442858326, a: 3.370245688, b: -10.902777766 },
    technician: { l: 92.58632532, a: 3.212452688, b: -9.389895772 },
    colorBrain: { l: 92.46983012, a: 3.308948067, b: -10.6887529 },
    technicianDe: 1.073,
    colorBrainDe: 0.153,
    improvement: 0.921,
  },
  {
    rowId: 23274028,
    substrate: "4P",
    target: { l: 47.596393824, a: 9.234710222, b: 11.52579998 },
    technician: { l: 48.72274983, a: 8.938335216, b: 11.37142398 },
    colorBrain: { l: 47.634, a: 9.1756, b: 11.3088 },
    technicianDe: 1.148,
    colorBrainDe: 0.152,
    improvement: 0.996,
  },
];
