/**
 * Marketing-site locale constants.
 *
 * URL path segment: `en` (unprefixed) / `zh`
 * html lang + Intl: `en` / `zh-CN`
 * hreflang: `en` / `zh-CN` (+ x-default → English home)
 */

export const LOCALES = ["en", "zh"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** Display labels for the language control. */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "EN",
  zh: "简体",
};

/** Full native names (aria / expanded control). */
export const LOCALE_NATIVE_NAMES: Record<Locale, string> = {
  en: "English",
  zh: "简体中文",
};

/** BCP 47 tags for document language and Intl formatting. */
export const LOCALE_HTML_LANG: Record<Locale, string> = {
  en: "en",
  zh: "zh-CN",
};

/** hreflang attribute values (EN counterpart `en`, ZH `zh-CN`). */
export const LOCALE_HREFLANG: Record<Locale, string> = {
  en: "en",
  zh: "zh-CN",
};

/** Intl.NumberFormat / toLocaleString locale tags. */
export const LOCALE_INTL: Record<Locale, string> = {
  en: "en-US",
  zh: "zh-CN",
};

export function isLocale(value: string | undefined | null): value is Locale {
  return value === "en" || value === "zh";
}

export function otherLocale(locale: Locale): Locale {
  return locale === "en" ? "zh" : "en";
}

export function parseLocale(value: string | undefined | null): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}
