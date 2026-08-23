import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  base: "./",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.png", "icons/apple-touch-icon.png"],
      manifest: {
        id: "/",
        name: "StrongLife",
        short_name: "StrongLife",
        description: "A 5x5 strength training tracker with plate math, progress charts and offline logging.",
        start_url: "./",
        scope: "./",
        display: "standalone",
        background_color: "#16181d",
        theme_color: "#16181d",
        orientation: "portrait",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icons/maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
        shortcuts: [
          {
            name: "Start Today's Workout",
            short_name: "Start Workout",
            url: "./#/?start=today",
            icons: [{ src: "icons/icon-192.png", sizes: "192x192", type: "image/png" }],
          },
          {
            name: "Progress",
            short_name: "Progress",
            url: "./#/progress",
            icons: [{ src: "icons/icon-192.png", sizes: "192x192", type: "image/png" }],
          },
          {
            name: "History",
            short_name: "History",
            url: "./#/history",
            icons: [{ src: "icons/icon-192.png", sizes: "192x192", type: "image/png" }],
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,ico}"],
      },
    }),
  ],
});
