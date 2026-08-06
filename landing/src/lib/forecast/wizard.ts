/**
 * Forecast Outlook wizard — client-side step machine, calc binding, analytics.
 * Progressive: preset → tune → reveal. No network calls.
 */

import {
  type ForecastInputs,
  type PresetId,
  calculateForecast,
  formatUsd,
  getPreset,
  REWORK_REDUCTION,
  TIME_RATE_PER_MINUTE,
} from "./model";

type Step = 1 | 2 | 3;

const INPUT_IDS = [
  "batchesPerMonth",
  "reworkPct",
  "costPerRework",
  "dyePerRework",
  "waterPerRework",
  "energyPerRework",
  "cycleMinutes",
] as const;

type InputId = (typeof INPUT_IDS)[number];

/** Fire analytics to dataLayer when present; always console-debug in dev. */
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
  const num = (id: InputId): number => {
    const el = root.querySelector<HTMLInputElement>(`#${id}`);
    return el ? parseFloat(el.value) || 0 : 0;
  };
  return {
    batchesPerMonth: num("batchesPerMonth"),
    reworkPct: num("reworkPct"),
    costPerRework: num("costPerRework"),
    dyePerRework: num("dyePerRework"),
    waterPerRework: num("waterPerRework"),
    energyPerRework: num("energyPerRework"),
    cycleMinutes: num("cycleMinutes"),
  };
}

function writeInputs(root: HTMLElement, inputs: ForecastInputs): void {
  const map: Record<InputId, number> = {
    batchesPerMonth: inputs.batchesPerMonth,
    reworkPct: inputs.reworkPct,
    costPerRework: inputs.costPerRework,
    dyePerRework: inputs.dyePerRework,
    waterPerRework: inputs.waterPerRework,
    energyPerRework: inputs.energyPerRework,
    cycleMinutes: inputs.cycleMinutes,
  };
  for (const id of INPUT_IDS) {
    const el = root.querySelector<HTMLInputElement>(`#${id}`);
    if (el) el.value = String(map[id]);
  }
}

function setStep(root: HTMLElement, step: Step): void {
  root.dataset.step = String(step);
  for (const panel of $all("[data-step-panel]", root)) {
    const n = Number(panel.getAttribute("data-step-panel"));
    const active = n === step;
    panel.hidden = !active;
    panel.setAttribute("aria-hidden", active ? "false" : "true");
  }
  for (const pill of $all("[data-step-indicator]", root)) {
    const n = Number(pill.getAttribute("data-step-indicator"));
    pill.classList.toggle("is-active", n === step);
    pill.classList.toggle("is-done", n < step);
    pill.setAttribute("aria-current", n === step ? "step" : "false");
  }
  // Focus first focusable in the newly shown panel for keyboard flow.
  const panel = root.querySelector<HTMLElement>(
    `[data-step-panel="${step}"]:not([hidden])`,
  );
  const focusable = panel?.querySelector<HTMLElement>(
    'button:not([disabled]), input:not([disabled]), [href], summary, [tabindex]:not([tabindex="-1"])',
  );
  focusable?.focus({ preventScroll: true });
}

function animateValue(
  el: HTMLElement,
  target: number,
  reduced: boolean,
): void {
  if (reduced) {
    el.textContent = formatUsd(target);
    return;
  }
  const duration = 900;
  const start = performance.now();
  const from = 0;
  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / duration);
    // ease-out cubic
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = formatUsd(from + (target - from) * eased);
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function renderResult(root: HTMLElement, inputs: ForecastInputs): void {
  const result = calculateForecast(inputs);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const cons = $("[data-out-conservative]", root);
  const exp = $("[data-out-expected]", root);
  const opt = $("[data-out-optimistic]", root);
  if (cons) animateValue(cons, result.annual.conservative, reduced);
  if (exp) animateValue(exp, result.annual.expected, reduced);
  if (opt) animateValue(opt, result.annual.optimistic, reduced);

  const setCat = (key: string, value: number) => {
    const el = $(`[data-out-cat="${key}"]`, root);
    if (el) el.textContent = formatUsd(value);
  };
  setCat("rework", result.breakdown.rework);
  setCat("dye", result.breakdown.dye);
  setCat("water", result.breakdown.water);
  setCat("energy", result.breakdown.energy);
  setCat("time", result.breakdown.time);

  const meta = $("[data-out-meta]", root);
  if (meta) {
    meta.textContent = `${Math.round(result.annualBatches).toLocaleString("en-US")} batches/yr · ~${Math.round(result.currentReworkBatches).toLocaleString("en-US")} reworks today · ~${Math.round(result.avoidedReworkExpected).toLocaleString("en-US")} avoided (expected)`;
  }

  // Live preview chip on step 2
  const preview = $("[data-preview-value]", root);
  if (preview) preview.textContent = formatUsd(result.annual.expected);
}

export function initForecastWizard(root: HTMLElement): void {
  let step: Step = 1;
  let selectedPreset: PresetId = "medium";

  // Prefill medium by default so accept-defaults path works.
  writeInputs(root, getPreset("medium").inputs);
  renderResult(root, readInputs(root));
  setStep(root, 1);

  track("forecast_view", { path: "/forecast" });

  // Preset cards
  for (const btn of $all("[data-preset]", root)) {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-preset") as PresetId;
      selectedPreset = id;
      const preset = getPreset(id);
      writeInputs(root, preset.inputs);
      renderResult(root, readInputs(root));
      for (const b of $all("[data-preset]", root)) {
        const on = b.getAttribute("data-preset") === id;
        b.classList.toggle("is-selected", on);
        b.setAttribute("aria-pressed", on ? "true" : "false");
      }
      track("forecast_preset_select", { preset: id });
    });
  }
  // Mark medium selected initially
  for (const b of $all("[data-preset]", root)) {
    const on = b.getAttribute("data-preset") === "medium";
    b.classList.toggle("is-selected", on);
    b.setAttribute("aria-pressed", on ? "true" : "false");
  }

  // Input changes → live preview
  for (const id of INPUT_IDS) {
    const el = root.querySelector<HTMLInputElement>(`#${id}`);
    el?.addEventListener("input", () => {
      renderResult(root, readInputs(root));
    });
  }

  // Navigation
  root.querySelector("[data-goto-2]")?.addEventListener("click", () => {
    step = 2;
    setStep(root, step);
  });
  root.querySelector("[data-goto-3]")?.addEventListener("click", () => {
    step = 3;
    renderResult(root, readInputs(root));
    setStep(root, step);
    track("forecast_reveal", {
      preset: selectedPreset,
      ...readInputs(root),
    });
    // Kick reveal animation class
    const panel = root.querySelector("[data-step-panel='3']");
    panel?.classList.remove("is-revealed");
    // force reflow
    void (panel as HTMLElement | null)?.offsetWidth;
    panel?.classList.add("is-revealed");
  });
  root.querySelector("[data-back-1]")?.addEventListener("click", () => {
    step = 1;
    setStep(root, step);
  });
  root.querySelector("[data-back-2]")?.addEventListener("click", () => {
    step = 2;
    setStep(root, step);
  });

  // CTAs
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
      // Fallback: select a transient input
      window.prompt("Copy this link:", url);
    }
  });

  // Expose constants into methodology for transparency
  const red = $("[data-method-reduction]", root);
  if (red) {
    red.textContent = `Conservative ${(REWORK_REDUCTION.conservative * 100).toFixed(0)}% · Expected ${(REWORK_REDUCTION.expected * 100).toFixed(0)}% · Optimistic ${(REWORK_REDUCTION.optimistic * 100).toFixed(0)}% of current rework volume avoided.`;
  }
  const rate = $("[data-method-rate]", root);
  if (rate) {
    rate.textContent = `$${TIME_RATE_PER_MINUTE.toFixed(2)} / minute (provisional).`;
  }
}
