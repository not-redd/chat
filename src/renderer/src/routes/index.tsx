import { createFileRoute } from "@tanstack/react-router";
import { useRef, useEffect, useState } from "react";

interface Message {
	id: string;
	role: "user" | "assistant";
	content: string;
	reasoning?: string;
}

export const Route = createFileRoute("/")({
	component: RouteComponent
});

function RouteComponent() {
	const [messages, setMessages] = useState<Message[]>([]);
	const [input, setInput] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const messagesEndRef = useRef<HTMLDivElement>(null);

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	};

	useEffect(() => {
		scrollToBottom();
	}, [messages]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!input.trim() || isLoading) return;

		const userMessage: Message = {
			id: Date.now().toString(),
			role: "user",
			content: input.trim()
		};

		setMessages((prev) => [...prev, userMessage]);
		setInput("");
		setIsLoading(true);

		const assistantMessage: Message = {
			id: (Date.now() + 1).toString(),
			role: "assistant",
			content: "",
			reasoning: ""
		};

		setMessages((prev) => [...prev, assistantMessage]);

		try {
			const response = await fetch("app://localhost/v1/chat/completions", {
				method: "POST",
				headers: {
					"Content-Type": "application/json"
				},
				body: JSON.stringify({
					messages: [...messages, userMessage].map((m) => ({
						role: m.role,
						content: m.content
					})),
					stream: true,
					extra_body: {
						enable_reasoning: true
					}
				})
			});

			if (!response.body) {
				throw new Error("No response body");
			}

			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let accumulatedContent = "";
			let accumulatedReasoning = "";

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				const chunk = decoder.decode(value, { stream: true });
				const lines = chunk.split("\n").filter((line) => line.trim());

				for (const line of lines) {
					if (line.startsWith("data: ")) {
						const data = line.slice(6);
						if (data === "[DONE]") continue;

						try {
							const parsed = JSON.parse(data);
							const content = parsed.choices?.[0]?.delta?.content;
							const reasoning = parsed.choices?.[0]?.delta?.reasoning;

							if (content) {
								accumulatedContent += content;
								setMessages((prev) =>
									prev.map((m) =>
										m.id === assistantMessage.id
											? { ...m, content: accumulatedContent }
											: m
									)
								);
							}

							if (reasoning) {
								accumulatedReasoning += reasoning;
								setMessages((prev) =>
									prev.map((m) =>
										m.id === assistantMessage.id
											? { ...m, reasoning: accumulatedReasoning }
											: m
									)
								);
							}
						} catch {
							// Ignore parse errors
						}
					}
				}
			}
		} catch (error) {
			console.error("Chat error:", error);
			setMessages((prev) =>
				prev.map((m) =>
					m.id === assistantMessage.id
						? { ...m, content: "Error: Failed to get response" }
						: m
				)
			);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="flex flex-col h-screen bg-gray-900">
			<header className="flex-none px-6 py-4 border-b border-gray-800 bg-gray-900">
				<h1 className="text-xl font-semibold text-white">AI Chat</h1>
			</header>

			<div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
				{messages.length === 0 && (
					<div className="flex items-center justify-center h-full text-gray-500">
						<p className="text-center">
							Start a conversation by typing a message below.
						</p>
					</div>
				)}
				{messages.map((message) => (
					<div
						key={message.id}
						className={`flex ${
							message.role === "user" ? "justify-end" : "justify-start"
						}`}
					>
						<div
							className={`max-w-[80%] rounded-2xl px-4 py-3 space-y-2 ${
								message.role === "user"
									? "bg-blue-600 text-white"
									: "bg-gray-800 text-gray-100"
							}`}
						>
							{message.reasoning && message.role === "assistant" && (
								<details className="text-sm">
									<summary className="cursor-pointer text-gray-400 hover:text-gray-300 font-medium">
										Reasoning
									</summary>
									<div className="mt-2 p-2 bg-gray-900/50 rounded-lg text-gray-300">
										<p className="whitespace-pre-wrap">{message.reasoning}</p>
									</div>
								</details>
							)}
							<p className="whitespace-pre-wrap">{message.content}</p>
						</div>
					</div>
				))}
				{isLoading && (
					<div className="flex justify-start">
						<div className="bg-gray-800 text-gray-100 rounded-2xl px-4 py-3">
							<div className="flex space-x-1">
								<div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" />
								<div
									className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"
									style={{ animationDelay: "0.1s" }}
								/>
								<div
									className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"
									style={{ animationDelay: "0.2s" }}
								/>
							</div>
						</div>
					</div>
				)}
				<div ref={messagesEndRef} />
			</div>

			<div className="flex-none px-4 py-4 border-t border-gray-800 bg-gray-900">
				<form onSubmit={handleSubmit} className="flex gap-3 max-w-4xl mx-auto">
					<input
						type="text"
						value={input}
						onChange={(e) => setInput(e.target.value)}
						placeholder="Type your message..."
						disabled={isLoading}
						className="flex-1 px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
					/>
					<button
						type="submit"
						disabled={isLoading || !input.trim()}
						className="px-6 py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
					>
						{isLoading ? "..." : "Send"}
					</button>
				</form>
			</div>
		</div>
	);
}
