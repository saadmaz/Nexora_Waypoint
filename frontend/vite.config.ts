import basicSsl from "@vitejs/plugin-basic-ssl";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vitest/config";

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),

    // The field apps work offline: the service worker precaches the app shell, CSS, JS and the
    // self-hosted fonts, and reads data (GET) network-first with the cache as the fallback. After
    // one visit the app opens with no network (field conventions section 11).
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["nexora-logo.svg", "nexora-logo.png"],
      manifest: {
        name: "Waypoint",
        short_name: "Waypoint",
        description: "Waypoint Group deliveries: load, drive and record, online or offline.",
        display: "standalone",
        start_url: "/",
        scope: "/",
        background_color: "#0e1113",
        theme_color: "#07090a",
        icons: [
          { src: "nexora-logo.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          { src: "nexora-logo.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,woff2,svg}"],
        // Fontsource ships every script; the field apps need Latin, Sinhala and Tamil.
        globIgnores: ["**/*cyrillic*", "**/*vietnamese*", "**/*greek*", "**/*devanagari*"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // The mock server answers in the page, so nothing to cache today; the real API will
            // be read network-first, with the last good answer as the offline fallback.
            urlPattern: ({ request, url }) => request.method === "GET" && url.pathname.startsWith("/api/"),
            handler: "NetworkFirst",
            options: {
              cacheName: "waypoint-data",
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
        ],
      },
    }),

    // `npm run dev:https` (mode "https"): a self-signed certificate on the LAN, because the camera
    // and GPS need a secure context on a phone.
    ...(mode === "https" ? [basicSsl()] : []),
  ],
  server: mode === "https" ? { host: true } : undefined,
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
}));
