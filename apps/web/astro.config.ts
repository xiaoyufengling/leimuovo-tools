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
      filter: (page) => !["/offline/", "/404/", "/403/", "/500/"].some((path) => page.includes(path)),
    }),
    AstroPWA({
      registerType: "autoUpdate",
      injectRegister: "script",
      includeAssets: [
        "favicon.ico",
        "favicon-32.png",
        "apple-touch-icon.png",
        "icons/brand-avatar-64.png",
        "icons/icon-192.png",
        "icons/icon-512.png",
        "icons/icon-maskable-512.png",
      ],
      manifest: {
        id: "/",
        name: "小鱼",
        short_name: "小鱼",
        description: "安静、快速、尊重隐私的个人浏览器工具集。",
        lang: "zh-CN",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#F7F7F8",
        theme_color: "#F7F7F8",
        categories: ["utilities", "productivity"],
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/icon-maskable-512.png",
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
              cacheName: "leimuovo-pages",
              networkTimeoutSeconds: 3,
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
