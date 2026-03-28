// AI API service for calling LLM APIs from the main process
import type { ChatCompletionChunk, ChatCompletionRequest } from "../shared/ipc-types";

export async function* callAIAPI(
  request: ChatCompletionRequest
): AsyncGenerator<ChatCompletionChunk, void, unknown> {
  const { config, messages } = request;

  try {
    const response = await fetch(`${config.url}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: messages.map((m) => ({
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

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        yield { content: "", done: true };
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
              yield { content: delta, done: false };
            }
          } catch {
            // Ignore parsing errors
          }
        }
      }
    }
  } catch (error) {
    console.error("AI API Error:", error);
    throw error;
  }
}
