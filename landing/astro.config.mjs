import { defineConfig } from "astro/config";
import { DEFAULT_LOCALE, LOCALES } from "./src/i18n/locales.ts";

export default defineConfig({
  site: "https://colorbrain.co",
  i18n: {
    defaultLocale: DEFAULT_LOCALE,
    // Live routes only — derived from LOCALES. Menu-only placeholders stay out.
    locales: [...LOCALES],
    routing: {
      // English unprefixed; other live locales use /{locale}/.
      // Do not enable preferred-locale / Accept-Language redirects.
      prefixDefaultLocale: false,
    },
  },
  // Temporary: emailed /forecast links should not 404 after the rename.
  redirects: {
    "/forecast": "/calculator",
    "/zh/forecast": "/zh/calculator",
    "/zh-tw/forecast": "/zh-tw/calculator",
    "/vi/forecast": "/vi/calculator",
  },
});
