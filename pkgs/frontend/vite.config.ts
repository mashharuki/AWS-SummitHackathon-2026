import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("three") || id.includes("@react-three")) {
            return "three-vendor";
          }
          if (id.includes("amazon-cognito-identity-js")) {
            return "cognito-vendor";
          }
          if (id.includes("/node_modules/ai/")) {
            return "ai-vendor";
          }
          if (id.includes("react-router-dom") || id.includes("react-router")) {
            return "router-vendor";
          }
        },
      },
    },
  },
  server: {
    port: 5173,
  },
});
