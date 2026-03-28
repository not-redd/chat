import { ElectronAPI } from "@electron-toolkit/preload";

interface API {
  ipcInvoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
  ipcOn: (channel: string, callback: (...args: unknown[]) => void) => () => void;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    api: API;
  }
}

export {};
