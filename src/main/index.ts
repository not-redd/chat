import { join, dirname } from "path";
import { fileURLToPath } from "url";

import { electronApp, optimizer, is } from "@electron-toolkit/utils";
import { app, shell, BrowserWindow, protocol } from "electron";

const __dirname = dirname(fileURLToPath(import.meta.url));
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { streamText, createUIMessageStreamResponse } from "ai";

import icon from "../../resources/icon.png?asset";

// setup custom protocols handler - must be called before app is ready
protocol.registerSchemesAsPrivileged([
	{
		scheme: "app",
		privileges: {
			standard: true,
			secure: true,
			allowServiceWorkers: true,
			supportFetchAPI: true
		}
	}
]);

function createWindow(): void {
	// Create the browser window.
	const mainWindow = new BrowserWindow({
		width: 900,
		height: 670,
		show: false,
		autoHideMenuBar: true,
		...(process.platform === "linux" ? { icon } : {}),
		webPreferences: {
			preload: join(__dirname, "../preload/index.js"),
			sandbox: false,
			webSecurity: false
		}
	});

	mainWindow.on("ready-to-show", () => {
		mainWindow.show();
	});

	mainWindow.webContents.setWindowOpenHandler((details) => {
		shell.openExternal(details.url);
		return { action: "deny" };
	});

	// HMR for renderer base on electron-vite cli.
	// Load the remote URL for development or the local html file for production.
	if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
		mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
	} else {
		mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
	}
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
	// Set app user model id for windows
	electronApp.setAppUserModelId("com.electron");

	// Default open or close DevTools by F12 in development
	// and ignore CommandOrControl + R in production.
	// see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
	app.on("browser-window-created", (_, window) => {
		optimizer.watchWindowShortcuts(window);
	});

	// Register IPC handlers
	createWindow();

	app.on("activate", function () {
		// On macOS it's common to re-create a window in the app when the
		// dock icon is clicked and there are no other windows open.
		if (BrowserWindow.getAllWindows().length === 0) createWindow();
	});

	// Setup AI provider
	const baseURL =
		"https://gateway.ai.cloudflare.com/v1/b016ee0f55f7977d58c34e3b23862e0e/opencode/custom-oc/zen/go/v1";
	const apiKey = process.env.OPENAI_COMPATIBLE_API_KEY;
	const modelName = "kimi-k2.5";

	const provider = createOpenAICompatible({
		baseURL,
		apiKey,
		name: "opencode"
	});

	const model = provider(modelName);

	protocol.handle("app", async (request) => {
		const url = new URL(request.url);
		console.log("Protocol request:", request.url, "pathname:", url.pathname);

		// AI SDK /api/chat endpoint
		if (url.pathname === "/api/chat" && request.method === "POST") {
			const body = await request.json();
			const { messages, enable_reasoning } = body;

			const result = streamText({
				model,
				messages,
				providerOptions: {
					opencode: {
						enable_reasoning: enable_reasoning ?? false
					}
				}
			});

			// Return AI SDK UIMessage stream response
			return createUIMessageStreamResponse({
				stream: result.toUIMessageStream()
			});
		}

		// For other app:// requests, continue to file system
		return new Response("Not Found", { status: 404 });
	});
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
	if (process.platform !== "darwin") {
		app.quit();
	}
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
