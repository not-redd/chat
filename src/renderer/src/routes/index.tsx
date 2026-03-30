import { useChat } from "@ai-sdk/react";
import { createFileRoute } from "@tanstack/react-router";
import { DefaultChatTransport, type UIMessage, type TextUIPart, type ReasoningUIPart } from "ai";
import { useRef, useEffect, useState } from "react";
import { Streamdown } from "streamdown";

export const Route = createFileRoute("/")({
	component: RouteComponent
});

function RouteComponent() {
	const transport = new DefaultChatTransport({
		api: "app://localhost/api/chat",
		body: {
			enable_reasoning: true
		}
	});

	const { messages, sendMessage, status } = useChat({
		transport
	});

	const [input, setInput] = useState("");

	const messagesEndRef = useRef<HTMLDivElement>(null);

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	};

	useEffect(() => {
		scrollToBottom();
	}, [messages]);

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setInput(e.target.value);
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!input.trim() || status === "submitted" || status === "streaming") return;

		await sendMessage({ text: input.trim() });
		setInput("");
	};

	const isLoading = status === "submitted" || status === "streaming";

	// Extract text from message parts
	const getMessageText = (message: UIMessage) => {
		const textParts = message.parts?.filter((part): part is TextUIPart => part.type === "text");
		return textParts?.map((p) => p.text).join("") ?? "";
	};

	// Extract reasoning from message parts
	const getReasoning = (message: UIMessage) => {
		const reasoningParts = message.parts?.filter(
			(part): part is ReasoningUIPart => part.type === "reasoning"
		);
		return reasoningParts?.map((p) => p.text).join("") ?? "";
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
				{messages.map((message) => {
					const messageText = getMessageText(message);
					const reasoningText = getReasoning(message);

					return (
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
								{reasoningText && message.role === "assistant" && (
									<details className="text-sm">
										<summary className="cursor-pointer text-gray-400 hover:text-gray-300 font-medium">
											Reasoning
										</summary>
										<div className="mt-2 p-2 bg-gray-900/50 rounded-lg text-gray-300">
											<Streamdown className="prose prose-invert prose-sm max-w-none">
												{reasoningText}
											</Streamdown>
										</div>
									</details>
								)}
								<Streamdown className="prose prose-invert max-w-none">
									{messageText}
								</Streamdown>
							</div>
						</div>
					);
				})}
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
						onChange={handleInputChange}
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
