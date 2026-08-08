/**
 * Per-locale SEO head helpers: canonical + hreflang for all locales.
 */

import type { Locale } from "./locales";
import { DEFAULT_LOCALE, LOCALES, LOCALE_HREFLANG } from "./locales";
import { absoluteUrl, forecastHref, homeHref } from "./paths";

export type PageKind = "home" | "forecast";

export function pagePath(locale: Locale, page: PageKind): string {
  return page === "home" ? homeHref(locale) : forecastHref(locale);
}

export function canonicalFor(
  locale: Locale,
  page: PageKind,
  site?: string,
): string {
  return absoluteUrl(pagePath(locale, page), site);
}

export interface HreflangLink {
  hreflang: string;
  href: string;
}

/** All locale counterparts + x-default → English. */
export function hreflangLinks(
  page: PageKind,
  site = "https://colorbrain.co",
): HreflangLink[] {
  const links: HreflangLink[] = LOCALES.map((locale) => ({
    hreflang: LOCALE_HREFLANG[locale],
    href: absoluteUrl(pagePath(locale, page), site),
  }));
  links.push({
    hreflang: "x-default",
    href: absoluteUrl(pagePath(DEFAULT_LOCALE, page), site),
  });
  return links;
}
