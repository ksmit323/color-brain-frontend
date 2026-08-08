/**
 * Language preference cookie (marketing host only).
 * Path=/; SameSite=Lax; Secure on HTTPS; Max-Age ≈ 1 year.
 * No Domain= attribute in v1 (host-only).
 */

import { isLocale, type Locale } from "./locales";

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
 * Minimal cookie-read for the soft-entry inline head script.
 * Duplicated as a string in index.astro so it runs before paint without modules.
 */
export const SOFT_ENTRY_INLINE_SCRIPT = `(function(){try{var c=document.cookie.split(";");var pref=null;for(var i=0;i<c.length;i++){var p=c[i].trim();if(p.indexOf("cb_locale=")===0){pref=decodeURIComponent(p.slice(10));break;}}if(pref==="zh"&&location.pathname==="/"&&location.hash===""){location.replace("/zh/");}}catch(e){}})();`;
