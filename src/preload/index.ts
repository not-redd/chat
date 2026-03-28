import { electronAPI } from "@electron-toolkit/preload";
import { contextBridge, ipcRenderer } from "electron";

// Custom APIs for renderer - expose IPC functionality
declare global {
	interface Window {
		electron: typeof electronAPI;
		api: typeof api;
	}
}

const api = {
	ipcInvoke: (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args),
	ipcOn: (channel: string, callback: (...args: unknown[]) => void): (() => void) => {
		const wrappedCallback = (_event: unknown, ...args: unknown[]): void => callback(...args);
		ipcRenderer.on(channel, wrappedCallback);
		return () => ipcRenderer.off(channel, wrappedCallback);
	}
};

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
	try {
		contextBridge.exposeInMainWorld("electron", electronAPI);
		contextBridge.exposeInMainWorld("api", api);
	} catch (error) {
		console.error(error);
	}
} else {
	window.electron = electronAPI;
	window.api = api;
}
