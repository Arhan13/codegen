"use client";

import { useChat } from "@ai-sdk/react";
import { useState, useEffect } from "react";
import ComponentPreview from "./ComponentPreview";
import { LocalizationDB, ComponentEntry } from "../lib/database";
import { processComponentWithTranslations } from "../lib/textExtractor";

export default function Editor() {
  const [input, setInput] = useState("");
  const { messages, sendMessage } = useChat();
  const [currentComponent, setCurrentComponent] = useState<string>("");
  const [currentComponentId, setCurrentComponentId] = useState<string | null>(
    null
  );
  const [savedComponents, setSavedComponents] = useState<ComponentEntry[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSavedComponents, setShowSavedComponents] = useState(false);
  const [processedMessages, setProcessedMessages] = useState<Set<string>>(
    new Set()
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      sendMessage({
        text: `${input}`,
      });
      setInput("");
    }
  };

  // Process and save components
  const processComponent = async (
    componentCode: string,
    userPrompt: string
  ) => {
    setIsProcessing(true);
    try {
      console.log(
        "🔍 Processing component with NEW architecture:",
        componentCode.substring(0, 200) + "..."
      );

      // Generate component name and ID
      const componentName =
        userPrompt
          .replace(/[^a-zA-Z0-9\s]/g, "")
          .split(" ")
          .slice(0, 3)
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join("") + "Component";

      const componentId = `comp_${Date.now()}`;

      // NEW: Use unified processing function
      const { transformedCode, extractedTexts, savedKeys } =
        await processComponentWithTranslations(componentCode, componentId);

      console.log("🎯 NEW ARCHITECTURE RESULTS:");
      console.log("- Original code length:", componentCode.length);
      console.log("- Transformed code length:", transformedCode.length);
      console.log(
        `- Extracted texts (${extractedTexts.length}): ${JSON.stringify(
          extractedTexts,
          null,
          2
        )}`
      );
      console.log(
        `- Saved translation keys (${savedKeys.length}): ${JSON.stringify(
          savedKeys,
          null,
          2
        )}`
      );

      // Store the TRANSFORMED code (with t() calls) in database
      const componentEntry: Omit<ComponentEntry, "created_at" | "updated_at"> =
        {
          id: componentId,
          name: componentName,
          description: userPrompt,
          code: transformedCode, // ✅ Store transformed code, not original
          user_prompt: userPrompt,
          extracted_keys: savedKeys,
        };

      // Save component to database
      const db = LocalizationDB.getInstance();
      await db.createComponent(componentEntry);

      // Update current component ID
      setCurrentComponentId(componentId);

      // Set the TRANSFORMED code as current component for preview
      setCurrentComponent(transformedCode);

      // Add to local state
      const newComponent: ComponentEntry = {
        ...componentEntry,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      setSavedComponents((prev) => [newComponent, ...prev]);

      console.log(
        `✅ NEW ARCHITECTURE: Processed ${componentName}, extracted ${extractedTexts.length} texts, code transformed and saved`
      );
    } catch (error) {
      console.error("Error processing component:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Load saved components
  const loadSavedComponents = async () => {
    try {
      const db = LocalizationDB.getInstance();
      const components = await db.getAllComponents();
      setSavedComponents(components);
    } catch (error) {
      console.error("Error loading saved components:", error);
    }
  };

  // Load components on mount
  useEffect(() => {
    loadSavedComponents();
  }, []);

  // Extract React component code from AI responses
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (
      lastMessage &&
      lastMessage.role === "assistant" &&
      !processedMessages.has(lastMessage.id)
    ) {
      const text =
        lastMessage.parts.find((part) => part.type === "text")?.text || "";

      // Look for React component code in code blocks
      const codeBlockRegex = /```(?:tsx?|jsx?|react)?\n([\s\S]*?)\n```/g;
      const matches = [...text.matchAll(codeBlockRegex)];

      if (matches.length > 0) {
        // Get the last code block (most recent component)
        const componentCode = matches[matches.length - 1][1];
        if (
          componentCode.includes("export default") ||
          componentCode.includes("function") ||
          componentCode.includes("const")
        ) {
          // Mark this message as processed to prevent infinite loops
          setProcessedMessages((prev) => new Set(prev).add(lastMessage.id));

          // Auto-process and save new components - this will set the transformed component code
          const userMessage = messages[messages.length - 2];
          if (userMessage && userMessage.role === "user") {
            const userPrompt =
              userMessage.parts.find((part) => part.type === "text")?.text ||
              "";
            processComponent(componentCode, userPrompt);
          } else {
            // If no user message found, set the original code as fallback
            setCurrentComponent(componentCode);
          }
        }
      }
    }
  }, [messages, processedMessages]);

  return (
    <div className="flex h-full">
      {/* Chat Section */}
      <div className="w-1/2 flex flex-col relative">
        {/* Scrollable Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 pb-32">
          <div className="max-w-2xl mx-auto">
            <div className="mb-8">
              <div className="flex items-center justify-between mb-2">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  React Component Creator
                </h1>
                <button
                  onClick={() => setShowSavedComponents(!showSavedComponents)}
                  className="px-3 py-1 text-sm bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-md transition-colors"
                >
                  {showSavedComponents ? "Hide" : "Show"} Saved (
                  {savedComponents.length})
                </button>
              </div>
              <p className="text-gray-600 dark:text-gray-400">
                Describe the React component you want to create, and I&apos;ll
                build it for you with a live preview. Components are
                automatically saved and text is extracted for localization.
                {isProcessing && (
                  <span className="ml-2 text-blue-600 font-medium">
                    ⚙️ Processing component...
                  </span>
                )}
              </p>
            </div>

            {/* Saved Components Section */}
            {showSavedComponents && (
              <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                  Saved Components
                </h3>
                {savedComponents.length === 0 ? (
                  <p className="text-gray-500 text-sm">
                    No saved components yet. Create one to get started!
                  </p>
                ) : (
                  <div className="space-y-2">
                    {savedComponents.slice(0, 5).map((component) => (
                      <div
                        key={component.id}
                        className="flex items-center justify-between p-2 bg-white dark:bg-gray-700 rounded border"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-gray-900 dark:text-white truncate">
                            {component.name}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {component.description}
                          </div>
                          <div className="text-xs text-blue-600 mt-1">
                            {component.extracted_keys.length} translation keys
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setCurrentComponent(component.code);
                            setCurrentComponentId(component.id);
                          }}
                          className="ml-2 px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
                        >
                          Load
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {messages.length === 0 && (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 mb-6">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                  Try these examples:
                </h3>
                <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <div>
                    • &quot;Create a modern button component with hover
                    effects&quot;
                  </div>
                  <div>
                    • &quot;Build a user profile card with avatar and social
                    links&quot;
                  </div>
                  <div>• &quot;Make a responsive navigation menu&quot;</div>
                  <div>• &quot;Design a pricing card component&quot;</div>
                </div>
              </div>
            )}

            {messages.map((message) => (
              <div key={message.id} className="mb-6">
                <div
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-3xl rounded-lg px-4 py-3 ${
                      message.role === "user"
                        ? "bg-blue-500 text-white ml-12"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white mr-12"
                    }`}
                  >
                    <div className="text-sm font-medium mb-1">
                      {message.role === "user" ? "You" : "AI Assistant"}
                    </div>
                    {message.parts.map((part, i) => {
                      switch (part.type) {
                        case "text":
                          return (
                            <div
                              key={`${message.id}-${i}`}
                              className="whitespace-pre-wrap"
                            >
                              {part.text}
                            </div>
                          );
                      }
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Fixed Chat Input */}
        <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 p-6">
          <div className="max-w-2xl mx-auto">
            <form onSubmit={handleSubmit}>
              <div className="relative flex items-end bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl shadow-lg hover:shadow-xl transition-shadow duration-200">
                <textarea
                  className="flex-1 px-6 py-4 bg-transparent text-lg placeholder-zinc-500 dark:placeholder-zinc-400 focus:outline-none resize-none min-h-[56px] max-h-32 overflow-y-auto"
                  value={input}
                  placeholder="Describe the React component you want to create..."
                  onChange={(e) => setInput(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e);
                    }
                  }}
                  rows={1}
                  style={{
                    height: "auto",
                    minHeight: "56px",
                  }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = "auto";
                    target.style.height =
                      Math.min(target.scrollHeight, 128) + "px";
                  }}
                />
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="mr-2 mb-2 p-3 bg-blue-500 hover:bg-blue-600 disabled:bg-zinc-300 dark:disabled:bg-zinc-600 text-white rounded-xl transition-colors duration-200 disabled:cursor-not-allowed"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m22 2-7 20-4-9-9-4Z" />
                    <path d="M22 2 11 13" />
                  </svg>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Preview Section */}
      <div className="w-1/2 border-l border-gray-200 dark:border-gray-700">
        <ComponentPreview componentCode={currentComponent} />
      </div>
    </div>
  );
}
