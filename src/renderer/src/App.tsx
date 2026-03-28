import { useCallback, useEffect, useRef, useState } from "react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

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

  const handleSubmit = (e: React.SubmitEvent): void => {
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
    async (e: React.SubmitEvent) => {
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
        const response = await fetch(`${config.url}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.apiKey}`
          },
          body: JSON.stringify({
            model: config.model,
            messages: [...messages, userMessage].map((m) => ({
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
        let assistantContent = "";
        const assistantMessageId = (Date.now() + 1).toString();

        setMessages((prev) => [
          ...prev,
          {
            id: assistantMessageId,
            role: "assistant",
            content: ""
          }
        ]);

        while (reader) {
          const { done, value } = await reader.read();
          if (done) break;

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
                  assistantContent += delta;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMessageId ? { ...m, content: assistantContent } : m
                    )
                  );
                }
              } catch {
                // Ignore parsing errors
              }
            }
          }
        }
      } catch (error) {
        console.error("Error:", error);
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: "assistant",
            content: "Error: Failed to get response from AI."
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
      // make form submit
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
