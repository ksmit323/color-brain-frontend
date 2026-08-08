/**
 * Per-locale SEO head helpers: canonical + bidirectional hreflang.
 */

import type { Locale } from "./locales";
import { LOCALE_HREFLANG } from "./locales";
import { absoluteUrl, forecastHref, homeHref } from "./paths";

export type PageKind = "home" | "forecast";

export function pagePath(locale: Locale, page: PageKind): string {
  return page === "home" ? homeHref(locale) : forecastHref(locale);
}

export function canonicalFor(locale: Locale, page: PageKind, site?: string): string {
  return absoluteUrl(pagePath(locale, page), site);
}

export interface HreflangLink {
  hreflang: string;
  href: string;
}

/** en ↔ zh-CN counterparts + x-default → English. */
export function hreflangLinks(
  page: PageKind,
  site = "https://colorbrain.co",
): HreflangLink[] {
  return [
    { hreflang: LOCALE_HREFLANG.en, href: absoluteUrl(pagePath("en", page), site) },
    { hreflang: LOCALE_HREFLANG.zh, href: absoluteUrl(pagePath("zh", page), site) },
    { hreflang: "x-default", href: absoluteUrl(pagePath("en", page), site) },
  ];
}
