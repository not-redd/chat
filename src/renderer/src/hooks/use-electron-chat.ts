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

export function useElectronChat(options: UseElectronChatOptions): UseChatHelpers<UIMessage> {
	const { config, id, initialMessages } = options;

	// Create custom transport that uses IPC
	const chat = useMemo<Chat<UIMessage>>(() => {
		const transport: ChatTransport = {
			sendMessages: async ({ chatId, messages }): Promise<ReadableStream<UIMessageChunk>> => {
				const streamId = `${chatId}-${Date.now()}`;

				return new ReadableStream<UIMessageChunk>({
					start(controller) {
						console.log("[Renderer] Stream started for streamId:", streamId);

						// Send text-start chunk first (required by AI SDK)
						controller.enqueue({
							type: "text-start",
							id: streamId
						});
						console.log("[Renderer] Sent text-start chunk");

						// Handle incoming chunks from IPC
						const handleChunk = (message: StreamChunkMessage): void => {
							if (message.streamId !== streamId) return;

							if (message.chunk.done) {
								console.log("[Renderer] Received done chunk, sending text-end");
								// Send text-end chunk before closing
								controller.enqueue({
									type: "text-end",
									id: streamId
								});
								controller.close();
								cleanup();
							} else {
								console.log(
									"[Renderer] Received delta chunk:",
									message.chunk.content.slice(0, 30)
								);
								// Send text-delta chunk
								controller.enqueue({
									type: "text-delta",
									id: streamId,
									delta: message.chunk.content
								});
							}
						};

						// Handle errors from IPC
						const handleError = (message: StreamErrorMessage): void => {
							if (message.streamId !== streamId) return;
							controller.error(new Error(message.error));
							cleanup();
						};

						// Subscribe to IPC events
						const unsubscribeChunk = ipc.on("streamChunk", handleChunk);
						const unsubscribeError = ipc.on("streamError", handleError);

						const cleanup = (): void => {
							unsubscribeChunk();
							unsubscribeError();
						};

						// Convert UIMessages to our Message format and start the stream
						const request: ChatCompletionRequest = {
							config,
							messages: messages
								.filter((m) => m.role === "user" || m.role === "assistant")
								.map((m) => {
									// Extract text content from parts
									const textParts = m.parts
										.filter((p) => p.type === "text")
										.map((p) => (p as { text: string }).text);
									const content = textParts.join("");

									return {
										id: m.id,
										role: m.role as "user" | "assistant",
										content
									};
								}),
							streamId
						};

						// Send the request via IPC
						console.log("[Renderer] Sending chatCompletion IPC request");
						ipc.send("chatCompletion", request)
							.then(() => {
								console.log(
									"[Renderer] chatCompletion IPC request sent successfully"
								);
							})
							.catch((error: Error) => {
								console.error(
									"[Renderer] chatCompletion IPC request failed:",
									error
								);
								controller.error(error);
								cleanup();
							});
					}
				});
			},
			reconnectToStream: async (): Promise<ReadableStream<UIMessageChunk> | null> => {
				// We don't support stream reconnection in this simple implementation
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
