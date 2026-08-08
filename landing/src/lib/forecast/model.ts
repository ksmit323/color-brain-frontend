/**
 * Forecast Outlook — provisional client-side savings model.
 *
 * Anchored on Right First Time (RFT) — the language mills use — not "rework %".
 * Savings scale with the RFT lift the visitor sets (target − current).
 * Coefficients and cost ladders are assumption-backed placeholders until ops
 * validates them. Every scenario produces a range, never a single guaranteed
 * figure. See "How we calculate" on the page for the user-facing explanation.
 */

export type PresetId = "small" | "medium" | "large";

/** Conservative / expected / optimistic realization scenarios. */
export type ScenarioId = "conservative" | "expected" | "optimistic";

export const SCENARIO_IDS = [
  "conservative",
  "expected",
  "optimistic",
] as const satisfies readonly ScenarioId[];

/** English fallback labels — prefer catalog messages in the UI. */
export const SCENARIO_LABELS: Record<ScenarioId, string> = {
  conservative: "Conservative",
  expected: "Expected",
  optimistic: "Optimistic",
};

export type FormatLocale = "en" | "zh";

const INTL_LOCALE: Record<FormatLocale, string> = {
  en: "en-US",
  zh: "zh-CN",
};

/** Ops inputs collected by the wizard (all currency in USD for v1). */
export interface ForecastInputs {
  batchesPerMonth: number;
  /** Current right-first-time rate, 0–100. */
  currentRft: number;
  /** Target right-first-time rate with better first-attempt support, 0–100. */
  targetRft: number;
  costPerRework: number;
  dyePerRework: number;
  waterPerRework: number;
  energyPerRework: number;
  /** Minutes of machine/labor time per rework event. */
  cycleMinutes: number;
}

export interface ScenarioSavings {
  conservative: number;
  expected: number;
  optimistic: number;
}

export interface CategoryBreakdown {
  rework: number;
  dye: number;
  water: number;
  energy: number;
  time: number;
  total: number;
}

export interface ForecastResult {
  annual: ScenarioSavings;
  /** Category breakdown for every scenario (UI can switch without re-calc). */
  breakdowns: Record<ScenarioId, CategoryBreakdown>;
  /** Convenience alias for breakdowns.expected. */
  breakdown: CategoryBreakdown;
  annualBatches: number;
  /** Batches that miss RFT today (100 − currentRft). */
  currentMissBatches: number;
  /** Batches avoided under each scenario. */
  avoidedByScenario: Record<ScenarioId, number>;
  /** Batches avoided under the expected scenario. */
  avoidedReworkExpected: number;
  /** Target − current, clamped ≥ 0 (percentage points). */
  rftLiftPts: number;
  currentRft: number;
  targetRft: number;
}

export interface PresetDef {
  id: PresetId;
  label: string;
  hint: string;
  inputs: ForecastInputs;
}

/**
 * Vietnam-reality $/minute for cycle-time opportunity cost (machine +
 * operator + steam). Was $1.50 ($90/hr) — 36× Vietnam all-in labour
 * ($1.44/hr direct, $1.78 loaded). Now $0.07 ($4.20/hr) covers 2× labour +
 * machine opportunity at Vietnam industrial elec $0.085/kWh / water $0.32/m³.
 * Labeled as assumption in UI.
 */
export const TIME_RATE_PER_MINUTE = 0.07;

/**
 * Realization of the visitor-stated RFT lift by scenario.
 * Expected = full stated lift; conservative / optimistic band uncertainty
 * (not every miss is a full-cost rework; some lifts overshoot).
 * Provisional until pilot-validated.
 */
export const RFT_LIFT_REALIZATION = {
  conservative: 0.75,
  expected: 1.0,
  optimistic: 1.25,
} as const;

/**
 * Mill-scale presets. Batch volumes from industry machine-capacity bands
 * (~2 batches/machine/day × machine count × ~22 workdays) cross-checked
 * against public dyehouse ranges. RFT anchors near Tier-2 reality
 * (e.g. ~86% overall cited in factory questionnaire answers).
 */
export const PRESETS: PresetDef[] = [
  {
    id: "small",
    label: "Small mill",
    hint: "~10 batches / day",
    inputs: {
      batchesPerMonth: 250,
      currentRft: 82,
      targetRft: 90,
      costPerRework: 45,
      dyePerRework: 22,
      waterPerRework: 7,
      energyPerRework: 14,
      cycleMinutes: 180,
    },
  },
  {
    id: "medium",
    label: "Medium mill",
    hint: "~25 batches / day",
    inputs: {
      batchesPerMonth: 550,
      currentRft: 86,
      targetRft: 92,
      costPerRework: 65,
      dyePerRework: 30,
      waterPerRework: 9,
      energyPerRework: 18,
      cycleMinutes: 200,
    },
  },
  {
    id: "large",
    label: "Large mill",
    hint: "~55 batches / day",
    inputs: {
      batchesPerMonth: 1_200,
      currentRft: 88,
      targetRft: 93,
      costPerRework: 85,
      dyePerRework: 38,
      waterPerRework: 11,
      energyPerRework: 22,
      cycleMinutes: 240,
    },
  },
];

/** Default mill profile used for first paint and getPreset fallback. */
export const DEFAULT_PRESET_ID: PresetId = "medium";

export function getPreset(id: PresetId): PresetDef {
  return (
    PRESETS.find((p) => p.id === id) ??
    PRESETS.find((p) => p.id === DEFAULT_PRESET_ID)!
  );
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function timeCost(cycleMinutes: number): number {
  return Math.max(0, cycleMinutes) * TIME_RATE_PER_MINUTE;
}

/**
 * Pure annual savings estimate from ops inputs.
 * Formula (provisional):
 *   annual_batches = batches/mo × 12
 *   rft_lift_pts = max(0, targetRft − currentRft)
 *   full_avoided = annual_batches × rft_lift_pts / 100
 *   avoided[scenario] = full_avoided × realization[scenario]
 *   cost/rework = base + dye + water + energy + (minutes × rate)
 *   annual[scenario] = avoided[scenario] × cost/rework
 */
export function calculateForecast(raw: ForecastInputs): ForecastResult {
  const currentRft = clamp(raw.currentRft, 0, 100);
  let targetRft = clamp(raw.targetRft, 0, 100);
  // Target cannot be below current — no "negative savings" path.
  if (targetRft < currentRft) targetRft = currentRft;

  const inputs = {
    batchesPerMonth: clamp(raw.batchesPerMonth, 0, 50_000),
    currentRft,
    targetRft,
    costPerRework: clamp(raw.costPerRework, 0, 1_000_000),
    dyePerRework: clamp(raw.dyePerRework, 0, 1_000_000),
    waterPerRework: clamp(raw.waterPerRework, 0, 1_000_000),
    energyPerRework: clamp(raw.energyPerRework, 0, 1_000_000),
    cycleMinutes: clamp(raw.cycleMinutes, 0, 10_000),
  };

  const annualBatches = inputs.batchesPerMonth * 12;
  const rftLiftPts = inputs.targetRft - inputs.currentRft;
  const fullAvoided = annualBatches * (rftLiftPts / 100);
  const currentMissBatches = annualBatches * ((100 - inputs.currentRft) / 100);
  const tCost = timeCost(inputs.cycleMinutes);

  const costPer = {
    rework: inputs.costPerRework,
    dye: inputs.dyePerRework,
    water: inputs.waterPerRework,
    energy: inputs.energyPerRework,
    time: tCost,
  };
  const totalPer =
    costPer.rework +
    costPer.dye +
    costPer.water +
    costPer.energy +
    costPer.time;

  const avoidedByScenario = {
    conservative: fullAvoided * RFT_LIFT_REALIZATION.conservative,
    expected: fullAvoided * RFT_LIFT_REALIZATION.expected,
    optimistic: fullAvoided * RFT_LIFT_REALIZATION.optimistic,
  } as const satisfies Record<ScenarioId, number>;

  const annual: ScenarioSavings = {
    conservative: avoidedByScenario.conservative * totalPer,
    expected: avoidedByScenario.expected * totalPer,
    optimistic: avoidedByScenario.optimistic * totalPer,
  };

  const breakdownFor = (avoided: number, total: number): CategoryBreakdown => ({
    rework: avoided * costPer.rework,
    dye: avoided * costPer.dye,
    water: avoided * costPer.water,
    energy: avoided * costPer.energy,
    time: avoided * costPer.time,
    total,
  });

  const breakdowns: Record<ScenarioId, CategoryBreakdown> = {
    conservative: breakdownFor(
      avoidedByScenario.conservative,
      annual.conservative,
    ),
    expected: breakdownFor(avoidedByScenario.expected, annual.expected),
    optimistic: breakdownFor(avoidedByScenario.optimistic, annual.optimistic),
  };

  return {
    annual,
    breakdowns,
    breakdown: breakdowns.expected,
    annualBatches,
    currentMissBatches,
    avoidedByScenario: { ...avoidedByScenario },
    avoidedReworkExpected: avoidedByScenario.expected,
    rftLiftPts,
    currentRft: inputs.currentRft,
    targetRft: inputs.targetRft,
  };
}

export function formatUsd(n: number, locale: FormatLocale = "en"): string {
  const abs = Math.abs(n);
  const rounded = Math.round(abs);
  return (
    (n < 0 ? "-$" : "$") +
    rounded.toLocaleString(INTL_LOCALE[locale] ?? "en-US", {
      maximumFractionDigits: 0,
    })
  );
}

export function formatCount(n: number, locale: FormatLocale = "en"): string {
  return Math.round(n).toLocaleString(INTL_LOCALE[locale] ?? "en-US");
}
