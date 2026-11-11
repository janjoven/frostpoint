import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["favicon.svg", "offline.html"],
      manifest: {
        name: "FROSTPOINT",
        short_name: "Frostpoint",
        description: "Ice & purified water delivery in Masbate",
        theme_color: "#0369A1",
        background_color: "#F0F9FF",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        // The map library is ~800 KB and only needed on checkout/tracking: cache it when first used, not on install.
        globIgnores: ["**/assets/Map-*"],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/assets/Map-"),
            handler: "CacheFirst",
            options: { cacheName: "map-assets", expiration: { maxEntries: 4 } },
          },
          {
            urlPattern: ({ url }) => url.pathname === "/api/products" || url.pathname === "/api/locations",
            handler: "StaleWhileRevalidate",
            options: { cacheName: "catalog" },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
            handler: "NetworkFirst",
            options: { cacheName: "api", networkTimeoutSeconds: 6, expiration: { maxEntries: 60, maxAgeSeconds: 3600 } },
          },
        ],
      },
    }),
  ],
  server: { proxy: { "/api": "http://localhost:8000" } },
  test: { environment: "node" },
});
