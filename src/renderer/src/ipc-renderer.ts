// Type-safe IPC Renderer implementation based on https://carljin.com/electron-%E4%B8%AD%E4%BD%BF%E7%94%A8-type-safe-%E7%9A%84-ipc/
import type { IPCPayload, IPCResponse, MessageObj } from "../../shared/ipc-types";

type UnsubscribeFunction = () => void;

export class IPCRenderer<
  MessageType extends MessageObj<MessageType>,
  BackgroundMessageType extends MessageObj<BackgroundMessageType>
> {
  channel: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  listeners: Partial<Record<keyof BackgroundMessageType, Array<(...args: any[]) => void>>> = {};
  private unsubscribeMap: Map<string, UnsubscribeFunction> = new Map();

  constructor(channel = "IPC-bridge") {
    this.channel = channel;
    this._bindMessage();
  }

  async send<T extends keyof MessageType>(
    name: T,
    ...payload: Parameters<MessageType[T]>
  ): Promise<Awaited<ReturnType<MessageType[T]>>> {
    const ipcPayload: IPCPayload = {
      name: String(name),
      payload: payload as unknown[]
    };

    const data = (await window.api.ipcInvoke(this.channel, ipcPayload)) as IPCResponse<unknown>;

    if (data.type === "success") {
      return data.result as Awaited<ReturnType<MessageType[T]>>;
    } else {
      throw new Error(data.error);
    }
  }

  // Send message and receive async generator results as arrays
  async *sendGenerator<T extends keyof MessageType>(
    name: T,
    ...payload: Parameters<MessageType[T]>
  ): AsyncGenerator<
    Awaited<ReturnType<MessageType[T]>> extends AsyncGenerator<infer U, unknown, unknown>
      ? U
      : never,
    void,
    unknown
  > {
    const ipcPayload: IPCPayload = {
      name: String(name),
      payload: payload as unknown[],
      isGenerator: true
    };

    const data = (await window.api.ipcInvoke(this.channel, ipcPayload)) as IPCResponse<unknown[]>;

    if (data.type === "success") {
      for (const chunk of data.result) {
        yield chunk as Awaited<ReturnType<MessageType[T]>> extends AsyncGenerator<
          infer U,
          unknown,
          unknown
        >
          ? U
          : never;
      }
    } else {
      throw new Error(data.error);
    }
  }

  on<T extends keyof BackgroundMessageType>(
    name: T,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fn: (...args: any[]) => void
  ): UnsubscribeFunction {
    const key = name as keyof BackgroundMessageType;
    this.listeners[key] = this.listeners[key] || [];
    this.listeners[key].push(fn);

    return () => {
      const handlers = this.listeners[key];
      if (!handlers) return;
      const index = handlers.indexOf(fn);
      if (index >= 0) {
        handlers.splice(index, 1);
      }
    };
  }

  private _handleReceivingMessage(payloadData: {
    name: keyof BackgroundMessageType;
    payload: unknown[];
  }): void {
    const { name, payload } = payloadData;
    const handlers = this.listeners[name];

    if (handlers) {
      for (const fn of handlers) {
        fn(...payload);
      }
    }
  }

  private _bindMessage(): void {
    const unsubscribe = window.api.ipcOn(this.channel, (data) => {
      this._handleReceivingMessage(
        data as { name: keyof BackgroundMessageType; payload: unknown[] }
      );
    });
    this.unsubscribeMap.set(this.channel, unsubscribe);
  }
}
