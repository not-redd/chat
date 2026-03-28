import { resolve } from "path";

import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
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
		plugins: [
			tanstackRouter({
				target: "react",
				autoCodeSplitting: true
			}),
			react(),
			tailwindcss()
		]
	}
});
