/**
 * Marketing-site locale constants.
 *
 * Live routes: `en` (unprefixed) / `zh`
 * Menu also lists planned locales (Traditional Chinese, Vietnamese) as
 * disabled placeholders — no routes or catalogs until those ship.
 */

/** Locales with real pages + message catalogs. */
export const LOCALES = ["en", "zh"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** Compact codes shown in the language control. */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "EN",
  zh: "简",
};

/** Full names for live locales (native orthography). */
export const LOCALE_NATIVE_NAMES: Record<Locale, string> = {
  en: "English",
  zh: "简体中文",
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

export const LOCALE_MENU: readonly LocaleMenuEntry[] = [
  { id: "en", label: "EN", name: "English", live: true },
  { id: "zh", label: "简", name: "简体中文", live: true },
  { id: "zh-tw", label: "繁", name: "繁體中文", live: false },
  { id: "vi", label: "VI", name: "Tiếng Việt", live: false },
] as const;

/**
 * BCP 47 tags for `html lang` and hreflang (live locales only).
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

/** Home path for soft-entry redirect (`/` or `/zh/`). */
export function softEntryHomePath(locale: Locale): string {
  if (locale === DEFAULT_LOCALE) return "/";
  return `/${locale}/`;
}
