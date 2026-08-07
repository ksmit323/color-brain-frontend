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
  window.dispatchEvent(
    new CustomEvent("forecast:analytics", { detail: payload }),
  );
}

function $(sel: string, root: ParentNode = document): HTMLElement | null {
  return root.querySelector(sel);
}

function $all(sel: string, root: ParentNode = document): HTMLElement[] {
  return Array.from(root.querySelectorAll(sel));
}

function parseNumericInput(value: string): number {
  // Supports "86", "86%", "86.5 %", or empty while typing.
  const cleaned = value.replace(/%/g, "").trim();
  if (cleaned === "" || cleaned === "." || cleaned === "-") return 0;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function formatPercentValue(n: number): string {
  if (!Number.isFinite(n)) return "0%";
  const s = Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
  return `${s}%`;
}

function isPercentField(id: string): boolean {
  return id === "currentRft" || id === "targetRft";
}

function readInputs(root: HTMLElement): ForecastInputs {
  const out = {} as ForecastInputs;
  for (const id of INPUT_IDS) {
    const el = root.querySelector<HTMLInputElement>(`#${id}`);
    if (!el) continue;
    const raw = el.value;
    out[id] = isPercentField(id)
      ? parseNumericInput(raw)
      : parseFloat(raw) || 0;
  }
  return out;
}

function writeInputs(root: HTMLElement, inputs: ForecastInputs): void {
  for (const id of INPUT_IDS) {
    const el = root.querySelector<HTMLInputElement>(`#${id}`);
    if (!el) continue;
    const v = inputs[id];
    el.value = isPercentField(id) ? formatPercentValue(v as number) : String(v);
  }
}

/** Share URL helpers — encode every Tune input so a copied link rehydrates exactly. */
function readInputsFromSearch(): {
  inputs: Partial<ForecastInputs>;
  scenario: ScenarioId | null;
  preset: PresetId | null;
} {
  const params = new URLSearchParams(window.location.search);
  const inputs: Partial<ForecastInputs> = {};
  for (const id of INPUT_IDS) {
    if (!params.has(id)) continue;
    const raw = params.get(id) ?? "";
    // Percent fields tolerate "86%" or "86" in the URL.
    const n = isPercentField(id) ? parseNumericInput(raw) : parseFloat(raw);
    if (Number.isFinite(n)) (inputs as Record<string, number>)[id] = n;
  }
  const scenarioRaw = params.get("scenario");
  const scenario = isScenarioId(scenarioRaw) ? scenarioRaw : null;
  const presetRaw = params.get("preset");
  const preset: PresetId | null =
    presetRaw === "small" || presetRaw === "medium" || presetRaw === "large"
      ? presetRaw
      : null;
  return { inputs, scenario, preset };
}

function buildShareUrl(root: HTMLElement, scenario: ScenarioId): string {
  const inputs = readInputs(root);
  const url = new URL(window.location.href);
  // Preserve pathname, replace search with current inputs.
  url.search = "";
  for (const id of INPUT_IDS) {
    const v = inputs[id];
    // Keep URL tidy: integers as integers, RFT with one decimal when needed.
    const s = isPercentField(id)
      ? Number.isInteger(v)
        ? String(v)
        : String(Math.round((v as number) * 10) / 10)
      : String(v);
    url.searchParams.set(id, s);
  }
  url.searchParams.set("scenario", scenario);
  return url.toString();
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

const PANEL_TRANSITION_MS = 320;
/** Start hero expand before panel transition fully ends (less dead air on reverse). */
const HERO_EXPAND_OVERLAP_MS = 140;
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

function setHeroA11y(step: Step): void {
  const hero = document.querySelector<HTMLElement>("[data-forecast-hero]");
  const slot = document.querySelector<HTMLElement>("[data-forecast-hero-slot]");
  const hide = step !== 1;
  if (hero) {
    hero.setAttribute("aria-hidden", hide ? "true" : "false");
    if (hide) hero.setAttribute("inert", "");
    else hero.removeAttribute("inert");
  }
  if (slot) {
    if (hide) slot.setAttribute("inert", "");
    else slot.removeAttribute("inert");
  }
}

/**
 * Collapse/expand intro hero and re-frame the wizard.
 * `main.dataset.step` drives CSS; can be delayed on reverse so hero expands
 * after the panel crossfade (avoids the jumpy Tune → Profile reverse).
 */
function applyPageChrome(
  root: HTMLElement,
  step: Step,
  opts: { instant?: boolean; scroll?: boolean; fromStep?: Step } = {},
): void {
  const main = root.closest(".forecast");
  if (main instanceof HTMLElement) main.dataset.step = String(step);
  setHeroA11y(step);

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (opts.instant || reduced || opts.scroll === false) return;

  const from = opts.fromStep;
  // Tune → Outlook: hero stays collapsed — revealing shouldn't re-scroll.
  if (from === 2 && step === 3) return;
  // Profile → Tune/Outlook: hero collapses via grid 0fr (300ms). Scrolling
  // immediately races that collapse — the wizard is measured pre-collapse,
  // then slides up and the forced scroll hides the steps under the nav.
  if (from === 1 && step > 1) return;
  // Outlook → Tune (Adjust numbers): user is scrolled down in results and
  // expects to land at the top of the Tune form — allow the scroll below.

  window.requestAnimationFrame(() => {
    if (step === 1) {
      const hero = document.querySelector<HTMLElement>("[data-forecast-hero]");
      (hero ?? root).scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    // Entering focused mode from Profile — pin wizard under the nav.
    root.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  });
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

    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const instant = opts.instant === true || reduced || !prev || prev === next;
    // Expand hero only after panel swap when going back to Profile.
    const deferHeroExpand = !instant && step === 1 && prevStep > 1;

    root.dataset.step = String(step);
    updateStepIndicators(root, step);

    if (deferHeroExpand) {
      // Keep main at previous step so the hero stays collapsed during panel anim.
      const main = root.closest(".forecast");
      if (main instanceof HTMLElement) main.dataset.step = String(prevStep);
    } else {
      applyPageChrome(root, step, {
        instant: opts.instant,
        fromStep: prevStep,
      });
    }

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

    // Overlap hero expand with the tail of the panel crossfade when returning
    // to Profile — cuts the “wait then text appears” hesitation.
    if (deferHeroExpand) {
      window.setTimeout(() => {
        applyPageChrome(root, 1, { scroll: true });
      }, HERO_EXPAND_OVERLAP_MS);
    }

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

function animateValue(el: HTMLElement, target: number, reduced: boolean): void {
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

  // Hydrate from share URL if present — lets a copied link rehydrate exactly.
  const shared = readInputsFromSearch();
  const hasSharedInputs = Object.keys(shared.inputs).length > 0;
  const initialInputs: ForecastInputs = hasSharedInputs
    ? { ...getPreset(DEFAULT_PRESET_ID).inputs, ...shared.inputs }
    : getPreset(DEFAULT_PRESET_ID).inputs;
  // If URL carries a scenario, respect it; otherwise default stays "expected".
  let hasHydratedScenario = false;
  if (shared.scenario) {
    selectedScenario = shared.scenario;
    hasHydratedScenario = true;
  }
  // If URL carries custom inputs, don't pretend a preset is selected.
  if (hasSharedInputs && shared.preset) selectedPreset = shared.preset;
  else if (hasSharedInputs) selectedPreset = "medium"; // keep internal, but UI shows no preset as selected until user picks
  writeInputs(root, initialInputs);
  lastResult = renderResult(root, initialInputs, {
    animate: false,
    reduced: prefersReduced,
    scenario: selectedScenario,
  });
  // Mark preset pills correctly when hydrating from a shared URL.
  if (hasSharedInputs) {
    // Clear all preset selection — inputs are custom, not a named preset.
    for (const b of $all("[data-preset]", root)) {
      b.classList.remove("is-selected");
      b.setAttribute("aria-pressed", "false");
    }
    track("forecast_share_hydrate", {
      ...initialInputs,
      scenario: selectedScenario,
    });
  }
  // Shared links land directly on Outlook so the recipient sees the same result.
  if (hasSharedInputs) {
    void setStep(root, 3, { focus: false, instant: true });
  } else {
    void setStep(root, 1, { focus: false, instant: true });
  }

  track("forecast_view", { path: "/forecast" });

  // Accordion panels — grid 0fr/1fr open/close (not native <details>).
  const bindAccordion = (
    rootSel: string,
    toggleSel: string,
    eventName: string,
  ) => {
    const panel = root.querySelector<HTMLElement>(rootSel);
    const toggle = root.querySelector<HTMLButtonElement>(toggleSel);
    toggle?.addEventListener("click", () => {
      if (!panel || !toggle) return;
      const open = !panel.classList.contains("is-open");
      panel.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      track(eventName, { open });
    });
  };
  bindAccordion("[data-costs]", "[data-costs-toggle]", "forecast_costs_toggle");
  bindAccordion(
    "[data-method]",
    "[data-method-toggle]",
    "forecast_method_toggle",
  );

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

  const selectScenario = (
    scenario: ScenarioId,
    opts: { track?: boolean } = {},
  ) => {
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
      if (
        ke.key !== "ArrowLeft" &&
        ke.key !== "ArrowRight" &&
        ke.key !== "Home" &&
        ke.key !== "End"
      ) {
        return;
      }
      ke.preventDefault();
      const idx = SCENARIO_IDS.indexOf(selectedScenario);
      let next = idx;
      if (ke.key === "ArrowLeft") next = Math.max(0, idx - 1);
      if (ke.key === "ArrowRight")
        next = Math.min(SCENARIO_IDS.length - 1, idx + 1);
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

  // Percent fields show “86%” at rest, but expose plain number on focus
  // for clean editing. The % stays left-aligned with the digits — not a far-right suffix.
  for (const id of ["currentRft", "targetRft"] as const) {
    const el = root.querySelector<HTMLInputElement>(`#${id}`);
    if (!el) continue;
    el.addEventListener("focus", () => {
      const n = parseNumericInput(el.value);
      // Only strip if value is currently formatted with %.
      if (el.value.endsWith("%")) {
        const plain = Number.isInteger(n)
          ? String(n)
          : String(Math.round(n * 10) / 10);
        el.value = plain;
        // Select number for quick overwrite, but keep cursor if user tabbed.
        requestAnimationFrame(() => el.select());
      }
    });
    el.addEventListener("blur", () => {
      const n = parseNumericInput(el.value);
      const clamped = Math.min(100, Math.max(0, n));
      el.value = formatPercentValue(clamped);
      // Preview and calc must see the formatted value — re-read.
      lastResult = renderResult(root, readInputs(root), {
        animate: false,
        reduced: prefersReduced,
        scenario: selectedScenario,
      });
    });
    el.addEventListener("keydown", (event) => {
      const e = event as KeyboardEvent;
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      e.preventDefault();
      const step = e.shiftKey ? 1 : 0.5;
      const n = parseNumericInput(el.value);
      const delta = e.key === "ArrowUp" ? step : -step;
      const next = Math.min(
        100,
        Math.max(0, Math.round((n + delta) * 10) / 10),
      );
      const isFocused = document.activeElement === el;
      el.value = isFocused ? String(next) : formatPercentValue(next);
      if (isFocused) requestAnimationFrame(() => el.select());
      lastResult = renderResult(root, readInputs(root), {
        animate: false,
        reduced: prefersReduced,
        scenario: selectedScenario,
      });
    });

    // Clickable stepper — mirrors native <input type=number> spinner for mouse users.
    const pctContainer = el.closest(".forecast__percent");
    const upBtn =
      pctContainer?.querySelector<HTMLButtonElement>('[data-spin="up"]');
    const downBtn =
      pctContainer?.querySelector<HTMLButtonElement>('[data-spin="down"]');

    const stepPercent = (dir: 1 | -1, shift: boolean): void => {
      const step = shift ? 1 : 0.5;
      const n = parseNumericInput(el.value);
      const next = Math.min(
        100,
        Math.max(0, Math.round((n + dir * step) * 10) / 10),
      );
      const isFocused = document.activeElement === el;
      el.value = isFocused ? String(next) : formatPercentValue(next);
      if (isFocused) requestAnimationFrame(() => el.select());
      lastResult = renderResult(root, readInputs(root), {
        animate: false,
        reduced: prefersReduced,
        scenario: selectedScenario,
      });
    };

    const bindStepper = (
      btn: HTMLButtonElement | null | undefined,
      dir: 1 | -1,
    ): void => {
      if (!btn) return;
      // Keep focus on the input so focus/blur formatting stays predictable.
      btn.addEventListener("mousedown", (e) => e.preventDefault());
      btn.addEventListener("click", (e) => {
        const me = e as MouseEvent;
        stepPercent(dir, me.shiftKey);
      });
      // Hold to repeat — like native spinner.
      let holdTimer: number | null = null;
      let repeatTimer: number | null = null;
      const clearHold = (): void => {
        if (holdTimer != null) {
          window.clearTimeout(holdTimer);
          holdTimer = null;
        }
        if (repeatTimer != null) {
          window.clearInterval(repeatTimer);
          repeatTimer = null;
        }
      };
      btn.addEventListener("pointerdown", (e) => {
        const pe = e as PointerEvent;
        // Only primary button, and capture so pointerup fires even if dragged off.
        if (pe.button !== 0) return;
        btn.setPointerCapture(pe.pointerId);
        // First repeat after a short hold, then faster — native-like.
        holdTimer = window.setTimeout(() => {
          repeatTimer = window.setInterval(
            () => stepPercent(dir, (e as PointerEvent).shiftKey),
            75,
          );
        }, 380);
      });
      const stop = (): void => clearHold();
      btn.addEventListener("pointerup", stop);
      btn.addEventListener("pointercancel", stop);
      btn.addEventListener("pointerleave", stop);
      // Also clear if window loses focus mid-hold.
      window.addEventListener("blur", clearHold);
    };

    bindStepper(upBtn, 1);
    bindStepper(downBtn, -1);
  }

  // Generic numeric steppers — same holo chrome as percent, steps from input's step attr.
  // Covers batches, all USD costs, and cycle minutes. Keeps HTML step=1 for labor/dye.
  for (const id of [
    "batchesPerMonth",
    "costPerRework",
    "dyePerRework",
    "waterPerRework",
    "energyPerRework",
    "cycleMinutes",
  ] as const) {
    const el = root.querySelector<HTMLInputElement>(`#${id}`);
    if (!el) continue;
    // Find wrapper (.forecast__number or .forecast__money) that holds the stepper.
    const container =
      el.closest(".forecast__number") ?? el.closest(".forecast__money");
    const upBtn =
      container?.querySelector<HTMLButtonElement>('[data-spin="up"]');
    const downBtn =
      container?.querySelector<HTMLButtonElement>('[data-spin="down"]');
    if (!upBtn && !downBtn) continue;

    const getStep = (): number => {
      const s = el.getAttribute("step");
      const n = s != null && s !== "" ? Number(s) : 1;
      return Number.isFinite(n) && n > 0 ? n : 1;
    };
    const getMin = (): number => {
      const a = el.getAttribute("min");
      const n = a != null && a !== "" ? Number(a) : 0;
      return Number.isFinite(n) ? n : 0;
    };
    const getMax = (): number => {
      const a = el.getAttribute("max");
      const n = a != null && a !== "" ? Number(a) : 1e9;
      return Number.isFinite(n) ? n : 1e9;
    };
    const roundForStep = (n: number, step: number): number => {
      // Avoid floating drift — round to step's decimal places.
      const decimals = String(step).split(".")[1]?.length ?? 0;
      const factor = 10 ** decimals;
      return Math.round(n * factor) / factor;
    };
    const stepNumeric = (dir: 1 | -1, shiftMult: number = 1): void => {
      const step = getStep() * shiftMult;
      const min = getMin();
      const max = getMax();
      const cur = parseFloat(el.value) || 0;
      const nextRaw = cur + dir * step;
      const next = Math.min(max, Math.max(min, roundForStep(nextRaw, step)));
      // Preserve integer formatting when step is integer.
      const decimals = String(step).split(".")[1]?.length ?? 0;
      el.value = decimals === 0 ? String(Math.round(next)) : String(next);
      // Dispatch input so preview RAF and native listeners see the change.
      el.dispatchEvent(new Event("input", { bubbles: true }));
      lastResult = renderResult(root, readInputs(root), {
        animate: false,
        reduced: prefersReduced,
        scenario: selectedScenario,
      });
      // Keep focus on the input for repeated spins.
      if (document.activeElement !== el) {
        // Don't steal focus if user is on stepper — but keep el focusable for keyboard repeat.
      }
    };
    const bindNumericStepper = (
      btn: HTMLButtonElement | null | undefined,
      dir: 1 | -1,
    ): void => {
      if (!btn) return;
      btn.addEventListener("mousedown", (e) => e.preventDefault());
      btn.addEventListener("click", (e) => {
        const me = e as MouseEvent;
        // Shift accelerates 5× for large jumps, like native shift stepping.
        const mult = me.shiftKey ? 5 : 1;
        stepNumeric(dir, mult);
      });
      let holdTimer: number | null = null;
      let repeatTimer: number | null = null;
      const clearHold = (): void => {
        if (holdTimer != null) {
          window.clearTimeout(holdTimer);
          holdTimer = null;
        }
        if (repeatTimer != null) {
          window.clearInterval(repeatTimer);
          repeatTimer = null;
        }
      };
      btn.addEventListener("pointerdown", (e) => {
        const pe = e as PointerEvent;
        if (pe.button !== 0) return;
        btn.setPointerCapture(pe.pointerId);
        holdTimer = window.setTimeout(() => {
          repeatTimer = window.setInterval(
            () => stepNumeric(dir, pe.shiftKey ? 5 : 1),
            70,
          );
        }, 380);
      });
      const stop = (): void => clearHold();
      btn.addEventListener("pointerup", stop);
      btn.addEventListener("pointercancel", stop);
      btn.addEventListener("pointerleave", stop);
      window.addEventListener("blur", clearHold);
    };
    bindNumericStepper(upBtn, 1);
    bindNumericStepper(downBtn, -1);
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
      // CTA “Reveal outlook” resets to Expected; hydrating a shared link keeps its scenario on first reveal.
      if (fromCta) {
        if (hasHydratedScenario) {
          hasHydratedScenario = false;
        } else {
          selectedScenario = "expected";
        }
      }
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

  root
    .querySelector("[data-cta-copy]")
    ?.addEventListener("click", async (e) => {
      e.preventDefault();
      track("forecast_cta_click", { cta: "copy_link" });
      const btn = e.currentTarget as HTMLButtonElement;
      const shareUrl = buildShareUrl(root, selectedScenario);
      // Keep address bar in sync so a second copy without re-click still has the latest params.
      try {
        history.replaceState(null, "", shareUrl);
      } catch {}
      try {
        await navigator.clipboard.writeText(shareUrl);
        const prev = btn.textContent;
        btn.textContent = "Link copied";
        btn.setAttribute("aria-live", "polite");
        setTimeout(() => {
          btn.textContent = prev;
        }, 1800);
      } catch {
        window.prompt("Copy this link:", shareUrl);
      }
    });
}
