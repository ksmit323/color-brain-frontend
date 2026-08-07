/**
 * Forecast Outlook wizard — client-side step machine, calc binding, analytics.
 * Progressive: preset → tune → reveal. No network calls.
 */

import {
  type CategoryBreakdown,
  type ForecastInputs,
  type ForecastResult,
  type PresetId,
  type ScenarioId,
  calculateForecast,
  DEFAULT_PRESET_ID,
  formatUsd,
  getPreset,
  SCENARIO_IDS,
  SCENARIO_LABELS,
} from "./model";

type Step = 1 | 2 | 3;

const INPUT_IDS = [
  "batchesPerMonth",
  "currentRft",
  "targetRft",
  "costPerRework",
  "dyePerRework",
  "waterPerRework",
  "energyPerRework",
  "cycleMinutes",
] as const satisfies readonly (keyof ForecastInputs)[];

/** Breakdown keys that have matching `[data-out-cat]` nodes (excludes total). */
const BREAKDOWN_CATS = [
  "rework",
  "dye",
  "water",
  "energy",
  "time",
] as const satisfies readonly (keyof CategoryBreakdown)[];

/** Fire analytics to dataLayer when present. */
function track(event: string, props: Record<string, unknown> = {}): void {
  const payload = { event, ...props };
  const w = window as Window & { dataLayer?: Record<string, unknown>[] };
  w.dataLayer = w.dataLayer ?? [];
  w.dataLayer.push(payload);
  window.dispatchEvent(new CustomEvent("forecast:analytics", { detail: payload }));
}

function $(sel: string, root: ParentNode = document): HTMLElement | null {
  return root.querySelector(sel);
}

function $all(sel: string, root: ParentNode = document): HTMLElement[] {
  return Array.from(root.querySelectorAll(sel));
}

function readInputs(root: HTMLElement): ForecastInputs {
  const out = {} as ForecastInputs;
  for (const id of INPUT_IDS) {
    const el = root.querySelector<HTMLInputElement>(`#${id}`);
    out[id] = el ? parseFloat(el.value) || 0 : 0;
  }
  return out;
}

function writeInputs(root: HTMLElement, inputs: ForecastInputs): void {
  for (const id of INPUT_IDS) {
    const el = root.querySelector<HTMLInputElement>(`#${id}`);
    if (el) el.value = String(inputs[id]);
  }
}

function setText(el: HTMLElement | null, value: string): void {
  if (el && el.textContent !== value) el.textContent = value;
}

function isScenarioId(v: string | null): v is ScenarioId {
  return v === "conservative" || v === "expected" || v === "optimistic";
}

function markPresetSelected(root: HTMLElement, id: PresetId): void {
  for (const b of $all("[data-preset]", root)) {
    const on = b.getAttribute("data-preset") === id;
    b.classList.toggle("is-selected", on);
    b.setAttribute("aria-pressed", on ? "true" : "false");
  }
}

function markScenarioSelected(root: HTMLElement, scenario: ScenarioId): void {
  for (const card of $all("[data-scenario]", root)) {
    const on = card.getAttribute("data-scenario") === scenario;
    card.classList.toggle("is-selected", on);
    card.setAttribute("aria-checked", on ? "true" : "false");
    card.setAttribute("tabindex", on ? "0" : "-1");
  }
}

const PANEL_TRANSITION_MS = 400;
const PANEL_ANIM_CLASSES = [
  "is-exit",
  "is-enter",
  "is-exit-forward",
  "is-exit-back",
  "is-enter-forward",
  "is-enter-back",
] as const;

function clearPanelAnim(panel: HTMLElement): void {
  panel.classList.remove(...PANEL_ANIM_CLASSES);
}

function focusFirstIn(panel: HTMLElement): void {
  const focusable = panel.querySelector<HTMLElement>(
    'button:not([disabled]), input:not([disabled]), [href], summary, [tabindex]:not([tabindex="-1"])',
  );
  focusable?.focus({ preventScroll: true });
}

function updateStepIndicators(root: HTMLElement, step: Step): void {
  for (const pill of $all("[data-step-indicator]", root)) {
    const n = Number(pill.getAttribute("data-step-indicator"));
    pill.classList.toggle("is-active", n === step);
    pill.classList.toggle("is-done", n < step);
    pill.setAttribute("aria-current", n === step ? "step" : "false");
  }
}

/** Active panel transition — rejects concurrent navigations until done. */
let stepLock: Promise<void> | null = null;

function setStep(
  root: HTMLElement,
  step: Step,
  opts: { focus?: boolean; instant?: boolean } = {},
): Promise<void> {
  const run = async () => {
    const prevStep = Number(root.dataset.step || "1") as Step;
    const panels = $all("[data-step-panel]", root) as HTMLElement[];
    const prev =
      panels.find((p) => p.classList.contains("is-active")) ??
      panels.find((p) => !p.hidden) ??
      null;
    const next = root.querySelector<HTMLElement>(`[data-step-panel="${step}"]`);
    if (!next) return;

    root.dataset.step = String(step);
    updateStepIndicators(root, step);

    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const instant = opts.instant === true || reduced || !prev || prev === next;

    if (instant) {
      for (const p of panels) {
        const active = p === next;
        clearPanelAnim(p);
        p.classList.toggle("is-active", active);
        p.hidden = !active;
        p.setAttribute("aria-hidden", active ? "false" : "true");
      }
      const stage = root.querySelector<HTMLElement>("[data-step-stage]");
      if (stage) stage.style.height = "";
      if (opts.focus !== false) focusFirstIn(next);
      return;
    }

    const forward = step > prevStep;
    const stage = root.querySelector<HTMLElement>("[data-step-stage]");
    const fromH = prev.offsetHeight;

    // Measure destination height without flashing content.
    next.hidden = false;
    next.setAttribute("aria-hidden", "false");
    next.classList.add("is-enter");
    next.style.visibility = "hidden";
    next.style.position = "absolute";
    next.style.inset = "0 auto auto 0";
    next.style.width = "100%";
    const toH = next.offsetHeight;
    next.style.visibility = "";
    next.style.position = "";
    next.style.inset = "";
    next.style.width = "";

    if (stage) {
      stage.style.height = `${fromH}px`;
      void stage.offsetHeight;
      stage.style.height = `${toH}px`;
    }

    clearPanelAnim(prev);
    prev.classList.remove("is-active");
    prev.classList.add("is-exit", forward ? "is-exit-forward" : "is-exit-back");
    prev.setAttribute("aria-hidden", "true");

    clearPanelAnim(next);
    next.classList.add(
      "is-active",
      "is-enter",
      forward ? "is-enter-forward" : "is-enter-back",
    );

    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, PANEL_TRANSITION_MS);
    });

    prev.hidden = true;
    clearPanelAnim(prev);
    clearPanelAnim(next);
    next.classList.add("is-active");
    if (stage) {
      // Release fixed height after layout settles on the active panel.
      stage.style.height = "";
    }
    if (opts.focus !== false) focusFirstIn(next);
  };

  const done = (stepLock ?? Promise.resolve()).then(run, run);
  stepLock = done.catch(() => {}).then(() => undefined);
  return done;
}

const animFrames = new WeakMap<HTMLElement, number>();

function animateValue(
  el: HTMLElement,
  target: number,
  reduced: boolean,
): void {
  const prev = animFrames.get(el);
  if (prev != null) cancelAnimationFrame(prev);

  if (reduced) {
    setText(el, formatUsd(target));
    animFrames.delete(el);
    return;
  }

  const duration = 900;
  const start = performance.now();
  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = formatUsd(target * eased);
    if (t < 1) {
      animFrames.set(el, requestAnimationFrame(tick));
    } else {
      animFrames.delete(el);
      // Snap to final formatted value (avoids float-easing drift at t=1).
      el.textContent = formatUsd(target);
    }
  };
  animFrames.set(el, requestAnimationFrame(tick));
}

function updatePreview(root: HTMLElement, inputs: ForecastInputs): void {
  const result = calculateForecast(inputs);
  setText($("[data-preview-value]", root), formatUsd(result.annual.expected));
}

function applyScenarioBreakdown(
  root: HTMLElement,
  result: ForecastResult,
  scenario: ScenarioId,
): void {
  const breakdown = result.breakdowns[scenario];
  const total = Math.max(0, breakdown.total);

  for (const key of BREAKDOWN_CATS) {
    const value = breakdown[key];
    setText($(`[data-out-cat="${key}"]`, root), formatUsd(value));

    // Row bars + top stack both use share of total so lengths compose to 100%.
    const share = total > 0 ? (value / total) * 100 : 0;

    const bar = root.querySelector<HTMLElement>(`[data-bar="${key}"]`);
    if (bar) bar.style.width = `${share}%`;

    const seg = root.querySelector<HTMLElement>(`[data-stack="${key}"]`);
    if (seg) seg.style.flexBasis = `${share}%`;
  }

  const label = SCENARIO_LABELS[scenario];
  setText($("[data-breakdown-title]", root), `${label} breakdown`);

  // Structured meta spans keep one line; scenario lives on the selected card.
  setText(
    $("[data-meta-batches]", root),
    `${Math.round(result.annualBatches).toLocaleString("en-US")} batches/yr`,
  );
  setText(
    $("[data-meta-rft]", root),
    result.rftLiftPts > 0
      ? `RFT ${Math.round(result.currentRft)}% → ${Math.round(result.targetRft)}% (+${result.rftLiftPts.toFixed(result.rftLiftPts % 1 === 0 ? 0 : 1)} pts)`
      : `RFT ${Math.round(result.currentRft)}%`,
  );
  setText(
    $("[data-meta-avoided]", root),
    Math.round(result.avoidedByScenario[scenario]).toLocaleString("en-US"),
  );
}

function renderResult(
  root: HTMLElement,
  inputs: ForecastInputs,
  opts: { animate: boolean; reduced: boolean; scenario: ScenarioId },
): ForecastResult {
  const result = calculateForecast(inputs);

  const cons = $("[data-out-conservative]", root);
  const exp = $("[data-out-expected]", root);
  const opt = $("[data-out-optimistic]", root);
  if (opts.animate) {
    if (cons) animateValue(cons, result.annual.conservative, opts.reduced);
    if (exp) animateValue(exp, result.annual.expected, opts.reduced);
    if (opt) animateValue(opt, result.annual.optimistic, opts.reduced);
  } else {
    setText(cons, formatUsd(result.annual.conservative));
    setText(exp, formatUsd(result.annual.expected));
    setText(opt, formatUsd(result.annual.optimistic));
  }

  markScenarioSelected(root, opts.scenario);
  applyScenarioBreakdown(root, result, opts.scenario);
  setText($("[data-preview-value]", root), formatUsd(result.annual.expected));
  return result;
}

export function initForecastWizard(root: HTMLElement): void {
  let selectedPreset: PresetId = DEFAULT_PRESET_ID;
  let selectedScenario: ScenarioId = "expected";
  let lastResult: ForecastResult | null = null;

  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let prefersReduced = reducedMotion.matches;
  reducedMotion.addEventListener("change", () => {
    prefersReduced = reducedMotion.matches;
  });

  const defaultInputs = getPreset(DEFAULT_PRESET_ID).inputs;
  writeInputs(root, defaultInputs);
  lastResult = renderResult(root, defaultInputs, {
    animate: false,
    reduced: prefersReduced,
    scenario: selectedScenario,
  });
  void setStep(root, 1, { focus: false, instant: true });

  track("forecast_view", { path: "/forecast" });

  for (const btn of $all("[data-preset]", root)) {
    const id = btn.getAttribute("data-preset") as PresetId;
    const on = id === DEFAULT_PRESET_ID;
    btn.classList.toggle("is-selected", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");

    btn.addEventListener("click", () => {
      selectedPreset = id;
      const preset = getPreset(id);
      writeInputs(root, preset.inputs);
      lastResult = renderResult(root, preset.inputs, {
        animate: false,
        reduced: prefersReduced,
        scenario: selectedScenario,
      });
      markPresetSelected(root, id);
      track("forecast_preset_select", { preset: id });
    });
  }

  const selectScenario = (scenario: ScenarioId, opts: { track?: boolean } = {}) => {
    if (selectedScenario === scenario && !opts.track) {
      markScenarioSelected(root, scenario);
      return;
    }
    selectedScenario = scenario;
    markScenarioSelected(root, scenario);
    if (lastResult) applyScenarioBreakdown(root, lastResult, scenario);
    if (opts.track !== false) {
      track("forecast_scenario_select", { scenario });
    }
  };

  for (const card of $all("[data-scenario]", root)) {
    card.addEventListener("click", () => {
      const id = card.getAttribute("data-scenario");
      if (isScenarioId(id)) selectScenario(id);
    });
    card.addEventListener("keydown", (e) => {
      const ke = e as KeyboardEvent;
      if (ke.key !== "ArrowLeft" && ke.key !== "ArrowRight" && ke.key !== "Home" && ke.key !== "End") {
        return;
      }
      ke.preventDefault();
      const idx = SCENARIO_IDS.indexOf(selectedScenario);
      let next = idx;
      if (ke.key === "ArrowLeft") next = Math.max(0, idx - 1);
      if (ke.key === "ArrowRight") next = Math.min(SCENARIO_IDS.length - 1, idx + 1);
      if (ke.key === "Home") next = 0;
      if (ke.key === "End") next = SCENARIO_IDS.length - 1;
      const nextId = SCENARIO_IDS[next]!;
      selectScenario(nextId);
      const nextCard = root.querySelector<HTMLElement>(
        `[data-scenario="${nextId}"]`,
      );
      nextCard?.focus({ preventScroll: true });
    });
  }

  let previewRaf: number | null = null;
  for (const id of INPUT_IDS) {
    const el = root.querySelector<HTMLInputElement>(`#${id}`);
    el?.addEventListener("input", () => {
      if (previewRaf != null) return;
      previewRaf = requestAnimationFrame(() => {
        previewRaf = null;
        updatePreview(root, readInputs(root));
      });
    });
  }

  const goToStep = (
    step: Step,
    opts: { animateReveal?: boolean; via?: "step_tab" | "cta" | "back" } = {},
  ) => {
    const current = Number(root.dataset.step || "1") as Step;
    if (step === current) return;

    if (step === 3) {
      const inputs = readInputs(root);
      const fromCta = opts.via === "cta" || opts.animateReveal === true;
      // CTA “Reveal outlook” resets to Expected; step tabs keep selection.
      if (fromCta) selectedScenario = "expected";
      lastResult = renderResult(root, inputs, {
        animate: fromCta,
        reduced: prefersReduced,
        scenario: selectedScenario,
      });
      track("forecast_reveal", {
        preset: selectedPreset,
        scenario: selectedScenario,
        via: opts.via ?? "cta",
        ...inputs,
      });
      void setStep(root, 3);
      return;
    }

    void setStep(root, step);
    if (opts.via) {
      track("forecast_step_nav", { step, from: current, via: opts.via });
    }
  };

  root.querySelector("[data-goto-2]")?.addEventListener("click", () => {
    goToStep(2, { via: "cta" });
  });
  root.querySelector("[data-goto-3]")?.addEventListener("click", () => {
    goToStep(3, { via: "cta", animateReveal: true });
  });
  root.querySelector("[data-back-1]")?.addEventListener("click", () => {
    goToStep(1, { via: "back" });
  });
  root.querySelector("[data-back-2]")?.addEventListener("click", () => {
    goToStep(2, { via: "back" });
  });

  for (const tab of $all("[data-goto-step]", root)) {
    tab.addEventListener("click", () => {
      const n = Number(tab.getAttribute("data-goto-step"));
      if (n === 1 || n === 2 || n === 3) {
        goToStep(n as Step, { via: "step_tab", animateReveal: false });
      }
    });
  }

  root.querySelector("[data-cta-pilot]")?.addEventListener("click", () => {
    track("forecast_cta_click", { cta: "book_pilot" });
  });

  root.querySelector("[data-cta-copy]")?.addEventListener("click", async (e) => {
    e.preventDefault();
    track("forecast_cta_click", { cta: "copy_link" });
    const btn = e.currentTarget as HTMLButtonElement;
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      const prev = btn.textContent;
      btn.textContent = "Link copied";
      btn.setAttribute("aria-live", "polite");
      setTimeout(() => {
        btn.textContent = prev;
      }, 1800);
    } catch {
      window.prompt("Copy this link:", url);
    }
  });
}
