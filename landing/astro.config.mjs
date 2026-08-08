import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://colorbrain.co",
  i18n: {
    defaultLocale: "en",
    // Live routes only. Planned locales (vi) are menu placeholders —
    // add them here when catalogs + pages ship.
    locales: ["en", "zh", "zh-tw"],
    routing: {
      // English unprefixed; zh under /zh/; zh-tw under /zh-tw/.
      // Do not enable preferred-locale / Accept-Language redirects.
      prefixDefaultLocale: false,
    },
  },
});
