// AI API service using OpenAI-compatible API from the main process
import type {
    ChatCompletionRequest,
    Message,
    StreamChunkMessage,
    StreamErrorMessage
} from "../shared/ipc-types";
import type { MainMessage, RenderMessage } from "../shared/ipc-types";
import { IPCMain } from "./ipc-main";

// IPC instance for sending stream chunks back to renderer
let ipc: IPCMain<RenderMessage, MainMessage> | null = null;

export function setIPCInstance(ipcInstance: IPCMain<RenderMessage, MainMessage>): void {
    ipc = ipcInstance;
}

export async function callAIAPI(request: ChatCompletionRequest): Promise<void> {
    const { config, messages, streamId } = request;

    if (!ipc) {
        throw new Error("IPC instance not set");
    }

    try {
        const response = await fetch(`${config.url}/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${config.apiKey}`
            },
            body: JSON.stringify({
                model: config.model,
                messages: messages.map((m: Message) => ({
                    role: m.role,
                    content: m.content
                })),
                stream: true
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
            throw new Error("No response body");
        }

        // Stream chunks in real-time to renderer
        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                const chunkMessage: StreamChunkMessage = {
                    streamId,
                    chunk: { content: "", done: true }
                };
                await ipc.send("streamChunk", chunkMessage);
                break;
            }

            const chunk = decoder.decode(value);
            const lines = chunk.split("\n");

            for (const line of lines) {
                if (line.startsWith("data: ")) {
                    const data = line.slice(6);
                    if (data === "[DONE]") continue;

                    try {
                        const parsed = JSON.parse(data);
                        const delta = parsed.choices?.[0]?.delta?.content;
                        if (delta) {
                            const chunkMessage: StreamChunkMessage = {
                                streamId,
                                chunk: { content: delta, done: false }
                            };
                            await ipc.send("streamChunk", chunkMessage);
                        }
                    } catch {
                        // Ignore parsing errors
                    }
                }
            }
        }
    } catch (error) {
        console.error("AI API Error:", error);
        const errorMessage: StreamErrorMessage = {
            streamId,
            error: error instanceof Error ? error.message : String(error)
        };
        await ipc.send("streamError", errorMessage);
    }
}
