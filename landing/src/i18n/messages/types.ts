/**
 * Shared message catalog shape. Every locale catalog must satisfy Messages so
 * key parity is enforced at typecheck time.
 */

export interface ForecastMessages {
  /** Wizard root aria-label */
  wizardAria: string;
  stepsAria: string;
  stepProfile: string;
  stepTune: string;
  stepOutlook: string;
  heroEyebrow: string;
  heroTitleBefore: string;
  heroTitleAfter: string;
  heroLede: string;
  step1Title: string;
  step1Lede: string;
  presetsAria: string;
  continue: string;
  step2Title: string;
  step2Lede: string;
  previewLabel: string;
  fieldBatches: string;
  fieldBatchesTip: string;
  fieldBatchesTag: string;
  fieldBatchesInc: string;
  fieldBatchesDec: string;
  fieldCurrentRft: string;
  fieldCurrentRftTip: string;
  fieldCurrentRftTag: string;
  fieldCurrentRftAria: string;
  fieldCurrentRftInc: string;
  fieldCurrentRftDec: string;
  fieldTargetRft: string;
  fieldTargetRftTip: string;
  fieldTargetRftTag: string;
  fieldTargetRftAria: string;
  fieldTargetRftInc: string;
  fieldTargetRftDec: string;
  costsToggle: string;
  costsHint: string;
  costsLede: string;
  fieldLabor: string;
  fieldLaborTip: string;
  fieldLaborTag: string;
  fieldLaborAria: string;
  fieldLaborInc: string;
  fieldLaborDec: string;
  fieldDye: string;
  fieldDyeTip: string;
  fieldDyeTag: string;
  fieldDyeAria: string;
  fieldDyeInc: string;
  fieldDyeDec: string;
  fieldWater: string;
  fieldWaterTip: string;
  fieldWaterTag: string;
  fieldWaterAria: string;
  fieldWaterInc: string;
  fieldWaterDec: string;
  fieldEnergy: string;
  fieldEnergyTip: string;
  fieldEnergyTag: string;
  fieldEnergyAria: string;
  fieldEnergyInc: string;
  fieldEnergyDec: string;
  fieldTime: string;
  fieldTimeTip: string;
  fieldTimeTag: string;
  fieldTimeAria: string;
  fieldTimeInc: string;
  fieldTimeDec: string;
  back: string;
  seeOutlook: string;
  step3Title: string;
  /** Prefix before avoided count: "Avoided ~" */
  avoidedPrefix: string;
  /** Suffix after avoided count: " wasted batches" */
  avoidedSuffix: string;
  rangeAria: string;
  scenarioConservative: string;
  scenarioExpected: string;
  scenarioOptimistic: string;
  /** Template: "{label} breakdown" — {label} is scenario name */
  breakdownTitle: string;
  stackTitle: string;
  breakdownAria: string;
  catRework: string;
  catDye: string;
  catWater: string;
  catEnergy: string;
  catTime: string;
  methodToggle: string;
  methodHint: string;
  methodLede: string;
  methodEqAnnual: string;
  methodEqBatches: string;
  methodEqLift: string;
  methodEqCost: string;
  methodBandCaption: string;
  methodBandUnit: string;
  methodBandAria: string;
  methodNote: string;
  /** e.g. "{rate}/min" — {rate} is formatted currency/min */
  methodRatePill: string;
  methodFoot: string;
  disclaimer: string;
  bookPilot: string;
  copyLink: string;
  linkCopied: string;
  copyPrompt: string;
  adjustNumbers: string;
  backHome: string;
  /** "{n} batches/yr" */
  batchesPerYear: string;
  /** RFT line with lift: "RFT {from}% → {to}% (+{pts} pts)" */
  rftWithLift: string;
  /** RFT line without lift: "RFT {pct}%" */
  rftOnly: string;
  presetSmall: string;
  presetSmallHint: string;
  presetMedium: string;
  presetMediumHint: string;
  presetLarge: string;
  presetLargeHint: string;
}

export interface Messages {
  common: {
    brand: string;
    openApp: string;
    requestPilot: string;
    siteNavAria: string;
  };
  nav: {
    howItWorks: string;
    proof: string;
    caseStudies: string;
    whoItsFor: string;
    forecast: string;
    /** Accessible name for the language menu control. */
    langAria: string;
  };
  footer: {
    tagline: string;
    site: string;
    founders: string;
    roleCeo: string;
    roleCommercial: string;
    roleTechnical: string;
    copyright: string;
  };
  hero: {
    eyebrow: string;
    headline1: string;
    headline2: string;
    subhead: string;
    metricsAria: string;
    metricPrecision: string;
    metricHoldout: string;
    metricInvented: string;
    scrollCue: string;
  };
  problem: {
    eyebrow: string;
    title: string;
    lede: string;
    indexAttempts: string;
    labelAttempts: string;
    indexFailure: string;
    labelFailure: string;
    indexCost: string;
    labelCost: string;
  };
  how: {
    eyebrow: string;
    title: string;
    lede: string;
    step1State: string;
    step1Title: string;
    step1Body: string;
    step2State: string;
    step2Title: string;
    step2Body: string;
    step3State: string;
    step3Title: string;
    step3Body: string;
    step4State: string;
    step4Title: string;
    step4Body: string;
  };
  proof: {
    eyebrow: string;
    title: string;
    lede: string;
    kicker: string;
    primaryTitle: string;
    signalLabel: string;
    cellProtocol: string;
    cellProtocolJobs: string;
    cellProtocolTrain: string;
    cellCoverage: string;
    cellCoverageRecs: string;
    cellMedian: string;
    cellMedianSub: string;
    cellSilence: string;
    cellSilenceSub: string;
    footnote: string;
  };
  cases: {
    eyebrow: string;
    title: string;
    lede: string;
    tabsAria: string;
    prevAria: string;
    nextAria: string;
    /** aria-label template for plate SVG */
    plateAria: string;
    ringSpec: string;
    keyCenter: string;
    keyDrift: string;
    jobLabel: string;
    closerLine: string;
    technician: string;
    colorBrain: string;
    target: string;
    missedSpec: string;
    withinSpec: string;
    /** "1 of 5 · every marker…" — {current} and {total} filled in component */
    hint: string;
  };
  who: {
    eyebrow: string;
    title: string;
    brandsTag: string;
    brandsTagline: string;
    brandsBody: string;
    suppliersTag: string;
    suppliersTagline: string;
    suppliersBody: string;
    factoriesTag: string;
    factoriesTagline: string;
    factoriesBody: string;
  };
  contact: {
    eyebrow: string;
    title: string;
    lede: string;
    subject: string;
    name: string;
    company: string;
    email: string;
    message: string;
    placeholder: string;
    submit: string;
  };
  seo: {
    homeTitle: string;
    homeDescription: string;
    forecastTitle: string;
    forecastDescription: string;
    siteName: string;
  };
  forecast: ForecastMessages;
}
