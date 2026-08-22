import sitemap from "@astrojs/sitemap";
import AstroPWA from "@vite-pwa/astro";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://leimuovo.com",
  output: "static",
  trailingSlash: "always",
  prefetch: {
    prefetchAll: false,
    defaultStrategy: "viewport",
  },
  integrations: [
    sitemap({
      filter: (page) => !["/offline/", "/404/", "/403/", "/500/", "/xiaoyugan/"].some((path) => page.includes(path)),
    }),
    AstroPWA({
      registerType: "autoUpdate",
      injectRegister: "script",
      includeAssets: [
        "favicon-rem-cat.ico",
        "favicon-rem-cat-32.png",
        "apple-touch-icon-rem-cat.png",
        "icons/rem-cat-brand-96.png",
        "icons/rem-cat-icon-192.png",
        "icons/rem-cat-icon-512.png",
        "icons/rem-cat-icon-maskable-512.png",
      ],
      manifest: {
        id: "/",
        name: "小鱼",
        short_name: "小鱼",
        description: "小鱼的个人网站。记录正在做的事、偶尔出现的想法，以及一些顺手做出来的小工具。",
        lang: "zh-CN",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#0B0B0D",
        theme_color: "#0B0B0D",
        categories: ["lifestyle", "productivity"],
        icons: [
          {
            src: "/icons/rem-cat-icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/rem-cat-icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/rem-cat-icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        // Astro already emits real HTML for every route. Disable Workbox's SPA
        // fallback so failed navigations reach the NetworkFirst offline fallback
        // instead of silently returning the home page.
        navigateFallback: null,
        globPatterns: ["**/*.{html,js,css,svg,png,ico,webmanifest}"],
        globIgnores: ["**/vendor/tesseract/**", "**/_astro/receipt-checker*"],
        runtimeCaching: [
          {
            urlPattern: ({ request, url }) => request.mode === "navigate"
              && !url.pathname.startsWith("/control/")
              && !url.pathname.startsWith("/api/control/"),
            handler: "NetworkFirst",
            options: {
              cacheName: "leimuovo-pages-v2",
              networkTimeoutSeconds: 8,
              precacheFallback: { fallbackURL: "/offline/" },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) => url.origin === self.location.origin && url.pathname.startsWith("/_astro/"),
            handler: "CacheFirst",
            options: {
              cacheName: "leimuovo-assets",
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) => url.origin === self.location.origin && url.pathname.startsWith("/vendor/tesseract/"),
            handler: "CacheFirst",
            options: {
              cacheName: "receipt-ocr-assets",
              expiration: { maxEntries: 24, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
});
