/**
 * Language preference cookie (marketing host only).
 * Path=/; SameSite=Lax; Secure on HTTPS; Max-Age ≈ 1 year.
 * No Domain= attribute in v1 (host-only).
 */

import {
  DEFAULT_LOCALE,
  isLocale,
  softEntryHomePath,
  type Locale,
} from "./locales";

export const PREFERENCE_COOKIE = "cb_locale";

const MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 year

/** Read preferred locale from document.cookie (browser only). */
export function readPreferenceCookie(
  cookieHeader: string | undefined = typeof document !== "undefined"
    ? document.cookie
    : undefined,
): Locale | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const [rawKey, ...rest] = part.trim().split("=");
    if (rawKey === PREFERENCE_COOKIE) {
      const value = decodeURIComponent(rest.join("=").trim());
      return isLocale(value) ? value : null;
    }
  }
  return null;
}

/** Write preference cookie. Call from language-control click handlers. */
export function writePreferenceCookie(locale: Locale): void {
  if (typeof document === "undefined") return;
  const secure =
    typeof location !== "undefined" && location.protocol === "https:"
      ? "; Secure"
      : "";
  document.cookie = `${PREFERENCE_COOKIE}=${encodeURIComponent(locale)}; Path=/; Max-Age=${MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
}

/**
 * Soft-entry pre-paint redirect (English home only).
 * Redirects to any non-default preferred locale home when on bare `/`.
 * Built as a static string for `is:inline` (no module imports before first paint).
 *
 * Keep locale list in sync with LOCALES (non-default only).
 */
const COOKIE_PREFIX = `${PREFERENCE_COOKIE}=`;
export const SOFT_ENTRY_INLINE_SCRIPT = `(function(){try{var c=document.cookie.split(";");var pref=null;var prefix=${JSON.stringify(COOKIE_PREFIX)};for(var i=0;i<c.length;i++){var p=c[i].trim();if(p.indexOf(prefix)===0){pref=decodeURIComponent(p.slice(prefix.length));break;}}var map={zh:"/zh/","zh-tw":"/zh-tw/",vi:"/vi/"};if(pref&&map[pref]&&location.pathname==="/"&&location.hash===""){location.replace(map[pref]);}}catch(e){}})();`;

/** Runtime helper for tests / non-inline callers. */
export function softEntryTarget(pref: Locale | null): string | null {
  if (!pref || pref === DEFAULT_LOCALE) return null;
  return softEntryHomePath(pref);
}
