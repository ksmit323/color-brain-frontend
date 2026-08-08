import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://colorbrain.co",
  i18n: {
    defaultLocale: "en",
    // Live routes only. Planned locales (zh-tw, vi) are menu placeholders —
    // add them here when catalogs + pages ship.
    locales: ["en", "zh"],
    routing: {
      // English unprefixed; Simplified Chinese under /zh/.
      // Do not enable preferred-locale / Accept-Language redirects.
      prefixDefaultLocale: false,
    },
  },
});
