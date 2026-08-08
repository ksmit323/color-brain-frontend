/**
 * Marketing-site locale constants.
 *
 * Live routes: `en` (unprefixed) / `zh` / `zh-tw` / `vi`
 */

/** Locales with real pages + message catalogs. */
export const LOCALES = ["en", "zh", "zh-tw", "vi"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** Compact codes shown in the language control. */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "EN",
  zh: "简",
  "zh-tw": "繁",
  vi: "VI",
};

/** Full names for live locales (native orthography). */
export const LOCALE_NATIVE_NAMES: Record<Locale, string> = {
  en: "English",
  zh: "简体中文",
  "zh-tw": "繁體中文",
  vi: "Tiếng Việt",
};

/**
 * Language menu entries. `live: false` = placeholder only (shown disabled).
 * Add a new language here first; wire routes/catalogs before flipping live.
 */
export type LocaleMenuEntry = {
  /** Stable id — becomes URL segment when live (except default `en`). */
  id: string;
  /** Short badge in the trigger / menu. */
  label: string;
  /** Native display name. */
  name: string;
  live: boolean;
};

/** Planned locales shown disabled until catalogs + routes ship. */
const LOCALE_MENU_PLACEHOLDERS: readonly LocaleMenuEntry[] = [];

/** Live rows derived from LOCALE_LABELS / LOCALE_NATIVE_NAMES; placeholders appended. */
export const LOCALE_MENU: readonly LocaleMenuEntry[] = [
  ...LOCALES.map((id) => ({
    id,
    label: LOCALE_LABELS[id],
    name: LOCALE_NATIVE_NAMES[id],
    live: true as const,
  })),
  ...LOCALE_MENU_PLACEHOLDERS,
];

/**
 * BCP 47 tags for `html lang` and hreflang (live locales only).
 */
export const LOCALE_HTML_LANG: Record<Locale, string> = {
  en: "en",
  zh: "zh-CN",
  "zh-tw": "zh-TW",
  vi: "vi",
};

/** hreflang attribute values — same BCP 47 tags as html lang. */
export const LOCALE_HREFLANG = LOCALE_HTML_LANG;

/** Intl.NumberFormat / toLocaleString locale tags. */
export const LOCALE_INTL: Record<Locale, string> = {
  en: "en-US",
  zh: "zh-CN",
  "zh-tw": "zh-TW",
  vi: "vi-VN",
};

/** Prefixed locale path segment (empty for default English). */
export function localePrefix(locale: Locale): string {
  return locale === DEFAULT_LOCALE ? "" : locale;
}

export function isLocale(value: string | undefined | null): value is Locale {
  return value != null && (LOCALES as readonly string[]).includes(value);
}

export function parseLocale(value: string | undefined | null): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** Home path for soft-entry redirect (`/` or `/zh/` or `/zh-tw/` or `/vi/`). */
export function softEntryHomePath(locale: Locale): string {
  if (locale === DEFAULT_LOCALE) return "/";
  return `/${locale}/`;
}
