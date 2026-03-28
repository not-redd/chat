// Custom hook for streaming chat using IPC and ai/react's useChat
import { useChat, type UseChatHelpers, type UIMessage, Chat } from "@ai-sdk/react";
import type { UIMessageChunk } from "ai";
import { useMemo } from "react";

import type {
	AIConfig,
	ChatCompletionRequest,
	MainMessage,
	RenderMessage,
	StreamChunkMessage,
	StreamErrorMessage
} from "../../../shared/ipc-types";
import { IPCRenderer } from "../ipc-renderer";

const ipc = new IPCRenderer<RenderMessage, MainMessage>();

interface UseElectronChatOptions {
	config: AIConfig;
	id?: string;
	initialMessages?: UIMessage[];
}

interface ChatTransport {
	sendMessages: (options: {
		trigger: "submit-message" | "regenerate-message";
		chatId: string;
		messageId: string | undefined;
		messages: UIMessage[];
		abortSignal: AbortSignal | undefined;
	}) => Promise<ReadableStream<UIMessageChunk>>;
	reconnectToStream: (options: {
		chatId: string;
	}) => Promise<ReadableStream<UIMessageChunk> | null>;
}

// Global stream registry to handle chunks that arrive before stream is created
const streamRegistry = new Map<
	string,
	{
		chunks: Array<StreamChunkMessage | StreamErrorMessage>;
		controller: ReadableStreamDefaultController<UIMessageChunk> | null;
		isReady: boolean;
	}
>();

// Set up global IPC handlers once
let isGlobalHandlerSetup = false;

function setupGlobalHandlers(): void {
	if (isGlobalHandlerSetup) return;
	isGlobalHandlerSetup = true;

	ipc.on("streamChunk", (message: StreamChunkMessage) => {
		const registry = streamRegistry.get(message.streamId);
		if (!registry) return;

		if (!registry.isReady || !registry.controller) {
			registry.chunks.push(message);
		} else {
			const controller = registry.controller;
			if (message.chunk.done) {
				controller.enqueue({ type: "text-end", id: message.streamId });
				controller.close();
				streamRegistry.delete(message.streamId);
			} else {
				controller.enqueue({
					type: "text-delta",
					id: message.streamId,
					delta: message.chunk.content
				});
			}
		}
	});

	ipc.on("streamError", (message: StreamErrorMessage) => {
		const registry = streamRegistry.get(message.streamId);
		if (!registry) return;

		if (!registry.isReady || !registry.controller) {
			registry.chunks.push(message);
		} else if (registry.controller) {
			registry.controller.error(new Error(message.error));
			streamRegistry.delete(message.streamId);
		}
	});
}

export function useElectronChat(options: UseElectronChatOptions): UseChatHelpers<UIMessage> {
	const { config, id, initialMessages } = options;

	// Set up global handlers
	setupGlobalHandlers();

	// Create custom transport that uses IPC
	const chat = useMemo<Chat<UIMessage>>(() => {
		const transport: ChatTransport = {
			sendMessages: async ({ chatId, messages }): Promise<ReadableStream<UIMessageChunk>> => {
				const streamId = `${chatId}-${Date.now()}`;

				// Register stream in global registry BEFORE sending request
				streamRegistry.set(streamId, {
					chunks: [],
					controller: null,
					isReady: false
				});

				// Prepare the request
				const request: ChatCompletionRequest = {
					config,
					messages: messages
						.filter((m) => m.role === "user" || m.role === "assistant")
						.map((m) => {
							const textParts = m.parts
								.filter((p) => p.type === "text")
								.map((p) => (p as { text: string }).text);
							return {
								id: m.id,
								role: m.role as "user" | "assistant",
								content: textParts.join("")
							};
						}),
					streamId
				};

				// Send the IPC request
				ipc.send("chatCompletion", request).catch((error: Error) => {
					const registry = streamRegistry.get(streamId);
					if (registry && !registry.isReady) {
						registry.chunks.push({
							streamId,
							error: error.message
						} as StreamErrorMessage);
					}
				});

				// Return the stream
				return new ReadableStream<UIMessageChunk>({
					start(controller) {
						const registry = streamRegistry.get(streamId);
						if (!registry) {
							controller.error(new Error("Stream registry not found"));
							return;
						}

						// Store controller
						registry.controller = controller;

						// Send text-start
						controller.enqueue({
							type: "text-start",
							id: streamId
						});

						// Mark as ready
						registry.isReady = true;

						// Process any pending chunks
						while (registry.chunks.length > 0) {
							const message = registry.chunks.shift()!;

							if ("chunk" in message) {
								if (message.chunk.done) {
									controller.enqueue({ type: "text-end", id: streamId });
									controller.close();
									streamRegistry.delete(streamId);
									return;
								} else {
									controller.enqueue({
										type: "text-delta",
										id: streamId,
										delta: message.chunk.content
									});
								}
							} else if ("error" in message) {
								controller.error(new Error(message.error));
								streamRegistry.delete(streamId);
								return;
							}
						}
					}
				});
			},
			reconnectToStream: async (): Promise<ReadableStream<UIMessageChunk> | null> => {
				return null;
			}
		};

		// Create Chat instance with transport
		return new Chat({
			id,
			messages: initialMessages,
			transport
		});
	}, [config, id, initialMessages]);

	// Use ai/react's useChat with the chat instance
	return useChat({
		chat
	});
}
