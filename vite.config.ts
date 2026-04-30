import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

const PRERENDER_ROUTES = [
  "/", "/features", "/pricing", "/compare", "/about", "/faq",
  "/changelog", "/contact", "/blog", "/privacy", "/terms",
  "/developers", "/store",
];

export default defineConfig(async ({ mode }) => {
  const vitePrerender = mode === "production"
    ? (await import("vite-plugin-prerender")).default
    : null;

  return {
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    mode === "production" && vitePrerender?.({
      staticDir: path.join(__dirname, "dist"),
      routes: PRERENDER_ROUTES,
    }),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.png", "icon-192.png", "icon-512.png"],
      manifest: {
        name: "Solera",
        short_name: "Solera",
        description: "Winery Management Platform",
        theme_color: "#6B1B2A",
        background_color: "#F5F0E8",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/~oauth/, /^\/api/, /^\/functions/, /^\/auth/],
        runtimeCaching: [
          {
            urlPattern: /\/rest\/v1\/tasks/,
            handler: "NetworkFirst",
            options: { cacheName: "tasks-cache", expiration: { maxEntries: 100, maxAgeSeconds: 86400 } },
          },
          {
            urlPattern: /\/rest\/v1\/lab_samples/,
            handler: "NetworkFirst",
            options: { cacheName: "lab-cache", expiration: { maxEntries: 200, maxAgeSeconds: 86400 } },
          },
          {
            urlPattern: /\/rest\/v1\/blocks/,
            handler: "StaleWhileRevalidate",
            options: { cacheName: "blocks-cache", expiration: { maxEntries: 100, maxAgeSeconds: 86400 } },
          },
          {
            urlPattern: /\/rest\/v1\/vintages/,
            handler: "StaleWhileRevalidate",
            options: { cacheName: "vintages-cache", expiration: { maxEntries: 100, maxAgeSeconds: 86400 } },
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom"],
  },
};
});
