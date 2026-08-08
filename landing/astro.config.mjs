import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://colorbrain.co",
  i18n: {
    defaultLocale: "en",
    locales: ["en", "zh"],
    routing: {
      // English stays at `/` and `/forecast`; Chinese under `/zh/…`.
      // Do not enable preferred-locale / Accept-Language redirects (R8 / KTD7).
      prefixDefaultLocale: false,
    },
  },
});
