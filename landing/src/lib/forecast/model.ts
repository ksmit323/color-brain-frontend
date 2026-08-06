/**
 * Forecast Outlook — provisional client-side savings model.
 *
 * Coefficients and improvement deltas are assumption-backed placeholders
 * until ops validates them. Every scenario produces a range, never a single
 * guaranteed figure. See "How we calculate" on the page for the user-facing
 * explanation of these assumptions.
 */

export type PresetId = "small" | "medium" | "large";

/** Ops inputs collected by the wizard (all currency in USD for v1). */
export interface ForecastInputs {
  batchesPerMonth: number;
  reworkPct: number;
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
  /** Breakdown of the expected scenario only (UI cards). */
  breakdown: CategoryBreakdown;
  annualBatches: number;
  currentReworkBatches: number;
  avoidedReworkExpected: number;
}

export interface PresetDef {
  id: PresetId;
  label: string;
  hint: string;
  inputs: ForecastInputs;
}

/**
 * Provisional $/minute for cycle-time opportunity cost
 * (machine + operator). Labeled as assumption in UI.
 */
export const TIME_RATE_PER_MINUTE = 1.5;

/**
 * Fraction of current rework volume Color Brain is assumed to avoid,
 * by scenario. Provisional until ops validates.
 */
export const REWORK_REDUCTION = {
  conservative: 0.25,
  expected: 0.45,
  optimistic: 0.65,
} as const;

export const PRESETS: PresetDef[] = [
  {
    id: "small",
    label: "Small mill",
    hint: "~40 batches / month",
    inputs: {
      batchesPerMonth: 40,
      reworkPct: 18,
      costPerRework: 800,
      dyePerRework: 120,
      waterPerRework: 40,
      energyPerRework: 55,
      cycleMinutes: 180,
    },
  },
  {
    id: "medium",
    label: "Medium mill",
    hint: "~120 batches / month",
    inputs: {
      batchesPerMonth: 120,
      reworkPct: 15,
      costPerRework: 1_200,
      dyePerRework: 180,
      waterPerRework: 55,
      energyPerRework: 90,
      cycleMinutes: 200,
    },
  },
  {
    id: "large",
    label: "Large mill",
    hint: "~300 batches / month",
    inputs: {
      batchesPerMonth: 300,
      reworkPct: 12,
      costPerRework: 1_500,
      dyePerRework: 220,
      waterPerRework: 70,
      energyPerRework: 120,
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
 *   rework_batches = annual_batches × rework%
 *   avoided = rework_batches × reduction_factor[scenario]
 *   cost/rework = base + dye + water + energy + (minutes × rate)
 *   annual = avoided × cost/rework
 */
export function calculateForecast(raw: ForecastInputs): ForecastResult {
  const inputs: ForecastInputs = {
    batchesPerMonth: clamp(raw.batchesPerMonth, 0, 10_000),
    reworkPct: clamp(raw.reworkPct, 0, 100),
    costPerRework: clamp(raw.costPerRework, 0, 1_000_000),
    dyePerRework: clamp(raw.dyePerRework, 0, 1_000_000),
    waterPerRework: clamp(raw.waterPerRework, 0, 1_000_000),
    energyPerRework: clamp(raw.energyPerRework, 0, 1_000_000),
    cycleMinutes: clamp(raw.cycleMinutes, 0, 10_000),
  };

  const annualBatches = inputs.batchesPerMonth * 12;
  const currentReworkBatches = annualBatches * (inputs.reworkPct / 100);
  const tCost = timeCost(inputs.cycleMinutes);

  const costPer = {
    rework: inputs.costPerRework,
    dye: inputs.dyePerRework,
    water: inputs.waterPerRework,
    energy: inputs.energyPerRework,
    time: tCost,
  };
  const totalPer =
    costPer.rework + costPer.dye + costPer.water + costPer.energy + costPer.time;

  const annual: ScenarioSavings = {
    conservative: currentReworkBatches * REWORK_REDUCTION.conservative * totalPer,
    expected: currentReworkBatches * REWORK_REDUCTION.expected * totalPer,
    optimistic: currentReworkBatches * REWORK_REDUCTION.optimistic * totalPer,
  };

  const avoidedExpected = currentReworkBatches * REWORK_REDUCTION.expected;
  const breakdown: CategoryBreakdown = {
    rework: avoidedExpected * costPer.rework,
    dye: avoidedExpected * costPer.dye,
    water: avoidedExpected * costPer.water,
    energy: avoidedExpected * costPer.energy,
    time: avoidedExpected * costPer.time,
    total: annual.expected,
  };

  return {
    annual,
    breakdown,
    annualBatches,
    currentReworkBatches,
    avoidedReworkExpected: avoidedExpected,
  };
}

export function formatUsd(n: number): string {
  const abs = Math.abs(n);
  const rounded = Math.round(abs);
  return (
    (n < 0 ? "-$" : "$") +
    rounded.toLocaleString("en-US", { maximumFractionDigits: 0 })
  );
}
