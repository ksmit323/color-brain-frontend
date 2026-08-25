/**
 * Locale-aware path helpers for marketing routes.
 * English is unprefixed; other locales live under `/{locale}/`.
 */

import { getRelativeLocaleUrl } from "astro:i18n";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "./locales";

/** Strip a trailing slash; empty or bare `/` normalizes to `/`. */
function stripTrailingSlash(path: string): string {
  return path.replace(/\/$/, "") || "/";
}

/** Home path for a locale (`/` or `/zh/` or `/zh-tw/` or `/vi/`). */
export function homeHref(locale: Locale = DEFAULT_LOCALE): string {
  return getRelativeLocaleUrl(locale, "/");
}

/** Calculator path for a locale. */
export function forecastHref(locale: Locale = DEFAULT_LOCALE): string {
  return getRelativeLocaleUrl(locale, "calculator");
}

/**
 * Section hash link. On home pages uses bare hash for smooth-scroll;
 * elsewhere uses locale home + hash so anchors resolve from any route.
 */
export function sectionHref(
  locale: Locale,
  hash: string,
  opts: { onHome?: boolean } = {},
): string {
  const normalized = hash.startsWith("#") ? hash : `#${hash}`;
  if (opts.onHome) return normalized;
  const path = homeHref(locale).replace(/\/$/, "");
  if (!path) return `/${normalized}`;
  return `${path}/${normalized}`;
}

/** True when path is the locale's home (with or without trailing slash). */
export function isHomePath(path: string, locale: Locale): boolean {
  return stripTrailingSlash(path) === stripTrailingSlash(homeHref(locale));
}

/** True when path is the locale's calculator page. */
export function isForecastPath(path: string, locale: Locale): boolean {
  return stripTrailingSlash(path) === stripTrailingSlash(forecastHref(locale));
}

/** Absolute site URL for a path (uses site origin from config). */
export function absoluteUrl(
  path: string,
  site = "https://colorbrain.co",
): string {
  const base = site.replace(/\/$/, "");
  if (!path || path === "/") return `${base}/`;
  return path.startsWith("/") ? `${base}${path}` : `${base}/${path}`;
}

/**
 * Counterpart path for a target locale (home ↔ home, calculator ↔ calculator).
 * Preserves hash best-effort for section landing when switching language.
 */
export function counterpartPath(
  path: string,
  _from: Locale,
  to: Locale,
): string {
  const bare = path.split("#")[0] ?? path;
  const isForecast = LOCALES.some((loc) => isForecastPath(bare, loc));
  if (isForecast) return forecastHref(to);

  const hashIdx = path.indexOf("#");
  const hash = hashIdx >= 0 ? path.slice(hashIdx) : "";
  if (!hash) return homeHref(to);
  return sectionHref(to, hash, { onHome: false });
}

/** Soft-entry is bare English home only (pathname `/`, empty hash). */
export function isSoftEntry(pathname: string, hash: string): boolean {
  return (pathname === "/" || pathname === "") && hash === "";
}
