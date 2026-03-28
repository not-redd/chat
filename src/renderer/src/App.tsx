import { useCallback, useEffect, useRef, useState } from "react";

import type { MainMessage, Message, RenderMessage } from "../../shared/ipc-types";
import { IPCRenderer } from "./ipc-renderer";

interface AIConfig {
  url: string;
  apiKey: string;
  model: string;
}

interface SettingsProps {
  config: AIConfig;
  onSave: (config: AIConfig) => void;
}

// Initialize IPC for type-safe communication
const ipc = new IPCRenderer<RenderMessage, MainMessage>();

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
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = (): void => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim() || isLoading) return;

      const userMessage: Message = {
        id: Date.now().toString(),
        role: "user",
        content: input
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setIsLoading(true);

      try {
        const assistantMessageId = (Date.now() + 1).toString();
        let assistantContent = "";

        setMessages((prev) => [
          ...prev,
          {
            id: assistantMessageId,
            role: "assistant",
            content: ""
          }
        ]);

        // Use type-safe IPC to call AI API from main process
        const stream = ipc.sendGenerator("chatCompletion", {
          config,
          messages: [...messages, userMessage]
        });

        for await (const chunk of stream) {
          if (chunk.content) {
            assistantContent += chunk.content;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMessageId ? { ...m, content: assistantContent } : m
              )
            );
          }
        }
      } catch (error) {
        console.error("Error:", error);
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: "assistant",
            content: `Error: ${error instanceof Error ? error.message : "Failed to get response from AI."}`
          }
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [input, isLoading, messages, config]
  );

  const formRef = useRef<HTMLFormElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
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
              <div className="message-role">{message.role === "user" ? "You" : "AI"}</div>
              <div className="message-text">{message.content}</div>
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
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSubmit} className="input-form" ref={formRef}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
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
