// IPC message type definitions based on https://carljin.com/electron-%E4%B8%AD%E4%BD%BF%E7%94%A8-type-safe-%E7%9A%84-ipc/

export interface Message {
	id: string;
	role: "user" | "assistant";
	content: string;
}

export interface AIConfig {
	url: string;
	apiKey: string;
	model: string;
}

export interface ChatCompletionRequest {
	config: AIConfig;
	messages: Message[];
	streamId: string;
}

export interface ChatCompletionChunk {
	content: string;
	done: boolean;
}

// Stream chunk message sent from main to renderer
export interface StreamChunkMessage {
	streamId: string;
	chunk: ChatCompletionChunk;
}

// Stream error message sent from main to renderer
export interface StreamErrorMessage {
	streamId: string;
	error: string;
}

// Type for function that can be called via IPC
export type IPCFunction = (
	...args: unknown[]
) => unknown | Promise<unknown> | AsyncGenerator<unknown, void, unknown>;

// Type for stored listener functions
export type ListenerFunction = (...args: unknown[]) => Promise<unknown> | unknown;

// Messages from renderer to main process
export interface RenderMessage {
	chatCompletion(request: ChatCompletionRequest): Promise<void>;
}

// Messages from main to renderer process
export interface MainMessage {
	streamChunk(message: StreamChunkMessage): void;
	streamError(message: StreamErrorMessage): void;
}

// Helper type for message objects
export type MessageObj<T> = {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	[K in keyof T]: (...args: any[]) => any;
};

// IPC response types
export interface IPCSuccessResponse<T> {
	type: "success";
	result: T;
}

export interface IPCErrorResponse {
	type: "error";
	error: string;
}

export type IPCResponse<T> = IPCSuccessResponse<T> | IPCErrorResponse;

// IPC payload types
export interface IPCPayload {
	name: string;
	payload: unknown[];
}
