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

/**
 * BCP 47 tags for `html lang` and hreflang (EN `en`, ZH `zh-CN`).
 * Same values serve both surfaces for v1.
 */
export const LOCALE_HTML_LANG: Record<Locale, string> = {
  en: "en",
  zh: "zh-CN",
};

/** hreflang attribute values — same BCP 47 tags as html lang. */
export const LOCALE_HREFLANG = LOCALE_HTML_LANG;

/** Intl.NumberFormat / toLocaleString locale tags. */
export const LOCALE_INTL: Record<Locale, string> = {
  en: "en-US",
  zh: "zh-CN",
};

export function isLocale(value: string | undefined | null): value is Locale {
  return value != null && (LOCALES as readonly string[]).includes(value);
}

export function otherLocale(locale: Locale): Locale {
  return locale === "en" ? "zh" : "en";
}

export function parseLocale(value: string | undefined | null): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}
