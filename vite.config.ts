import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

export default defineConfig({
  // Base path for serving the app under a subdirectory (e.g., /vendamax)
  // Configure at build time with: VITE_BASE_PATH=/vendamax/
  base: process.env.VITE_BASE_PATH ?? "/",
  plugins: [
    react(),
    // Allow disabling the runtime error overlay to surface original errors
    ...(process.env.VITE_RUNTIME_OVERLAY === '0' ? [] : [runtimeErrorOverlay()]),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          router: ["wouter"],
          query: ["@tanstack/react-query"],
          forms: ["react-hook-form", "@hookform/resolvers", "zod", "zod-validation-error"],
          ui: [
            "@radix-ui/react-dialog",
            "@radix-ui/react-select",
            "@radix-ui/react-tooltip",
            "@radix-ui/react-popover",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-toast",
            "@radix-ui/react-tabs",
            "@radix-ui/react-progress",
            "@radix-ui/react-switch",
            "@radix-ui/react-checkbox",
            "lucide-react",
          ],
          charts: ["recharts"],
          vendor: [
            "clsx",
            "class-variance-authority",
            "tailwind-merge",
            "date-fns",
          ],
        },
      },
    },
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
    // Allow disabling the default Vite HMR overlay via env var.
    // Set VITE_RUNTIME_OVERLAY=0 to disable the overlay (useful to surface original errors).
    hmr: {
      overlay: process.env.VITE_RUNTIME_OVERLAY === '0' ? false : true,
    },
    // Proxy API requests to backend server
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
