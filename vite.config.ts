import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// Rabbit Alley POS - Vite Configuration
// Powered by CoreDev Studio
export default defineConfig(({ mode }) => {
  const env = { ...process.env, ...loadEnv(mode, process.cwd(), "") };
  const frontendPort = parseInt(env.PORT || env.VITE_PORT || "8080", 10);
  const backendPort = parseInt(env.API_PORT || "8000", 10);

  return {
    server: {
      host: "::",
      port: frontendPort,
      hmr: {
        overlay: false,
      },
      proxy: {
        "/api": {
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
      },
    },
    plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Production build optimizations
    target: "esnext",
    minify: "esbuild",
    cssMinify: true,
    sourcemap: false,
    // Split chunks for better caching
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunk for React and related
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          // UI components chunk
          "vendor-ui": ["@radix-ui/react-dialog", "@radix-ui/react-select", "@radix-ui/react-dropdown-menu"],
          // Utility libraries
          "vendor-utils": ["clsx", "tailwind-merge", "date-fns"],
        },
      },
    },
    // Reduce chunk size warnings
    chunkSizeWarningLimit: 1000,
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ["react", "react-dom", "react-router-dom"],
  },
};
});

