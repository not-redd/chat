import { useState, useRef, useEffect } from "react";

import { useElectronChat } from "./hooks/use-electron-chat";

interface AIConfig {
	url: string;
	apiKey: string;
	model: string;
}

interface SettingsProps {
	config: AIConfig;
	onSave: (config: AIConfig) => void;
}

function Settings({ config, onSave }: SettingsProps): React.JSX.Element {
	const [url, setUrl] = useState(config.url);
	const [apiKey, setApiKey] = useState(config.apiKey);
	const [model, setModel] = useState(config.model);

	const handleSubmit = (e: React.FormEvent): void => {
		e.preventDefault();
		onSave({ url, apiKey, model });
	};

	return (
		<form onSubmit={handleSubmit} className="settings-form">
			<h2>AI Settings</h2>
			<div className="form-group">
				<label htmlFor="url">API URL</label>
				<input
					id="url"
					type="url"
					value={url}
					onChange={(e) => setUrl(e.target.value)}
					placeholder="https://api.openai.com/v1"
					required
				/>
			</div>
			<div className="form-group">
				<label htmlFor="apiKey">API Key</label>
				<input
					id="apiKey"
					type="password"
					value={apiKey}
					onChange={(e) => setApiKey(e.target.value)}
					placeholder="sk-..."
					required
				/>
			</div>
			<div className="form-group">
				<label htmlFor="model">Model</label>
				<input
					id="model"
					type="text"
					value={model}
					onChange={(e) => setModel(e.target.value)}
					placeholder="gpt-4"
					required
				/>
			</div>
			<button type="submit" className="btn-primary">
				Save Settings
			</button>
		</form>
	);
}

interface ChatProps {
	config: AIConfig;
	onOpenSettings: () => void;
}

function Chat({ config, onOpenSettings }: ChatProps): React.JSX.Element {
	const { messages, sendMessage, status, error } = useElectronChat({
		config
	});

	const [input, setInput] = useState("");
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const formRef = useRef<HTMLFormElement>(null);

	const scrollToBottom = (): void => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	};

	useEffect(() => {
		scrollToBottom();
	}, [messages]);

	const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
		setInput(e.target.value);
	};

	const handleSubmit = async (e: React.FormEvent): Promise<void> => {
		e.preventDefault();
		if (!input.trim()) return;

		const text = input;
		setInput("");
		await sendMessage({ text });
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			formRef.current?.requestSubmit();
		}
	};

	const isLoading = status === "submitted" || status === "streaming";

	// Extract text content from message parts
	const getMessageText = (message: (typeof messages)[0]): string => {
		return message.parts
			.filter((part) => part.type === "text")
			.map((part) => ("text" in part ? part.text : ""))
			.join("");
	};

	return (
		<div className="chat-container">
			<div className="chat-header">
				<h2>Chat</h2>
				<button onClick={onOpenSettings} className="btn-secondary">
					Settings
				</button>
			</div>
			<div className="messages-container">
				{messages.length === 0 && (
					<div className="empty-state">
						<p>Start a conversation by typing a message below.</p>
					</div>
				)}
				{messages.map((message) => (
					<div
						key={message.id}
						className={`message ${message.role === "user" ? "user" : "assistant"}`}
					>
						<div className="message-content">
							<div className="message-role">
								{message.role === "user" ? "You" : "AI"}
							</div>
							<div className="message-text">{getMessageText(message)}</div>
						</div>
					</div>
				))}
				{isLoading && (
					<div className="message assistant">
						<div className="message-content">
							<div className="message-role">AI</div>
							<div className="message-text loading">
								<span className="dot" />
								<span className="dot" />
								<span className="dot" />
							</div>
						</div>
					</div>
				)}
				{error && (
					<div className="message assistant error">
						<div className="message-content">
							<div className="message-role">Error</div>
							<div className="message-text">{error.message}</div>
						</div>
					</div>
				)}
				<div ref={messagesEndRef} />
			</div>
			<form onSubmit={handleSubmit} className="input-form" ref={formRef}>
				<textarea
					value={input}
					onChange={handleInputChange}
					onKeyDown={handleKeyDown}
					placeholder="Type your message..."
					rows={1}
					disabled={isLoading}
				/>
				<button type="submit" disabled={isLoading || !input.trim()}>
					Send
				</button>
			</form>
		</div>
	);
}

export default function App(): React.JSX.Element {
	const [showSettings, setShowSettings] = useState(false);
	const [config, setConfig] = useState<AIConfig>(() => {
		const saved = localStorage.getItem("ai-config");
		return saved
			? JSON.parse(saved)
			: {
					url: "https://api.openai.com/v1",
					apiKey: "",
					model: "gpt-4"
				};
	});

	const handleSaveConfig = (newConfig: AIConfig): void => {
		setConfig(newConfig);
		localStorage.setItem("ai-config", JSON.stringify(newConfig));
		setShowSettings(false);
	};

	return (
		<div className="app-container">
			{showSettings ? (
				<Settings config={config} onSave={handleSaveConfig} />
			) : (
				<Chat config={config} onOpenSettings={() => setShowSettings(true)} />
			)}
		</div>
	);
}
