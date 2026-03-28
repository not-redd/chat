// Type-safe IPC Main implementation based on https://carljin.com/electron-%E4%B8%AD%E4%BD%BF%E7%94%A8-type-safe-%E7%9A%84-ipc/
import { BrowserWindow, ipcMain, IpcMainInvokeEvent } from "electron";

import type { IPCPayload, IPCResponse, ListenerFunction, MessageObj } from "../shared/ipc-types";

export class IPCMain<
	MessageType extends MessageObj<MessageType>,
	BackgroundMessageType extends MessageObj<BackgroundMessageType>
> {
	channel: string;
	listeners: Partial<Record<keyof MessageType, ListenerFunction>> = {};

	constructor(channel = "IPC-bridge") {
		this.channel = channel;
		this._bindMessage();
	}

	on<T extends keyof MessageType>(
		name: T,
		fn: (...args: Parameters<MessageType[T]>) => ReturnType<MessageType[T]>
	): void {
		if (this.listeners[name]) throw new Error(`Message handler ${String(name)} already exists`);
		this.listeners[name] = fn as ListenerFunction;
	}

	off<T extends keyof MessageType>(action: T): void {
		if (this.listeners[action]) {
			delete this.listeners[action];
		}
	}

	async send<T extends keyof BackgroundMessageType>(
		name: T,
		...payload: Parameters<BackgroundMessageType[T]>
	): Promise<void> {
		const windows = BrowserWindow.getAllWindows();
		windows.forEach((window) => {
			window.webContents.send(this.channel, {
				name,
				payload
			});
		});
	}

	private _bindMessage(): void {
		ipcMain.handle(this.channel, this._handleReceivingMessage.bind(this));
	}

	private async _handleReceivingMessage(
		_event: IpcMainInvokeEvent,
		payload: IPCPayload
	): Promise<IPCResponse<unknown>> {
		try {
			const handler = this.listeners[payload.name as keyof MessageType];
			if (handler) {
				const result = await handler(...payload.payload);

				return {
					type: "success",
					result
				};
			} else {
				throw new Error(`Unknown IPC message ${String(payload.name)}`);
			}
		} catch (e) {
			return {
				type: "error",
				error: e instanceof Error ? e.message : String(e)
			};
		}
	}
}
