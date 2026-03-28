import { resolve } from "path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "electron-vite";

export default defineConfig({
  main: {
    build: {
      externalizeDeps: true,
      rollupOptions: {
        external: ["electron"]
      }
    }
  },
  preload: {
    build: {
      externalizeDeps: true,
      rollupOptions: {
        external: ["electron"]
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        "@renderer": resolve("src/renderer/src")
      }
    },
    plugins: [react()]
  }
});
