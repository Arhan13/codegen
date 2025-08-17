"use client";

import { useChat } from "@ai-sdk/react";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  FolderOpen,
  ChevronDown,
  Sparkles,
  Eye,
  MessageCircle,
  Globe,
  Calendar,
  Target,
  Palette,
  Cog,
} from "lucide-react";
import ComponentPreview from "./ComponentPreview";
import { LocalizationDB, ComponentEntry } from "../lib/database";
import { processComponentWithTranslations } from "../lib/textExtractor";

export default function Editor() {
  const [input, setInput] = useState("");
  const { messages, sendMessage, setMessages } = useChat();
  const [currentComponent, setCurrentComponent] = useState<string>("");
  const [currentComponentId, setCurrentComponentId] = useState<string | null>(
    null
  );

  const [savedComponents, setSavedComponents] = useState<ComponentEntry[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showComponentsDropdown, setShowComponentsDropdown] = useState(false);
  const [processedMessages, setProcessedMessages] = useState<Set<string>>(
    new Set()
  );
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load component's chat history into the current chat
  const loadComponentChat = async (componentId: string) => {
    try {
      const db = LocalizationDB.getInstance();
      const component = await db.getComponent(componentId);

      if (component && component.chat_messages) {
        const chatMessages = JSON.parse(component.chat_messages);
        setMessages(chatMessages);
        setCurrentComponentId(componentId);
        setCurrentComponent(component.code);
        console.log(
          `💬 Loaded ${chatMessages.length} messages for component ${componentId}`
        );
      }
    } catch (error) {
      console.error("Error loading component chat:", error);
    }
  };

  // Start a new conversation (clear chat history)
  const startNewConversation = () => {
    setMessages([]);
    setCurrentComponentId(null);
    setCurrentComponent("");
    console.log("💬 Started new conversation");
  };

  // Save current messages back to the current component
  const saveMessagesToCurrentComponent = useCallback(async () => {
    if (!currentComponentId) return;

    try {
      const db = LocalizationDB.getInstance();
      await db.updateComponent(currentComponentId, {
        chat_messages: JSON.stringify(messages),
      });
      console.log(
        `💾 Saved ${messages.length} messages to component ${currentComponentId}`
      );
    } catch (error) {
      console.error("Error saving messages to component:", error);
    }
  }, [currentComponentId, messages]);

  const handleSubmit = async (e: React.FormEvent) => {
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
        "Processing component with NEW architecture:",
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
      const { transformedCode, extractedTexts, savedKeys, demoProps } =
        await processComponentWithTranslations(componentCode, componentId);

      console.log("NEW ARCHITECTURE RESULTS:");
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
          code: transformedCode, // Store transformed code, not original
          user_prompt: userPrompt,
          chat_messages: JSON.stringify(messages), // Save chat history with component
          extracted_keys: savedKeys,
          demo_props: demoProps, // Store generated demo props
        };

      // Save component to database
      const db = LocalizationDB.getInstance();
      await db.createComponent(componentEntry);

      // Set the TRANSFORMED code as current component for preview
      setCurrentComponent(transformedCode);
      setCurrentComponentId(componentId);

      // Add to local state
      const newComponent: ComponentEntry = {
        ...componentEntry,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      setSavedComponents((prev) => [newComponent, ...prev]);

      console.log(
        `NEW ARCHITECTURE: Processed ${componentName}, extracted ${extractedTexts.length} texts, code transformed and saved`
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

  // Auto-save messages to current component when messages change
  useEffect(() => {
    if (currentComponentId && messages.length > 0) {
      // Debounce to avoid excessive database writes
      const timeoutId = setTimeout(() => {
        saveMessagesToCurrentComponent();
      }, 1000);

      return () => clearTimeout(timeoutId);
    }
  }, [messages, currentComponentId, saveMessagesToCurrentComponent]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowComponentsDropdown(false);
      }
    }

    if (showComponentsDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [showComponentsDropdown]);

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
                {savedComponents.length > 0 && (
                  <div className="relative" ref={dropdownRef}>
                    <button
                      onClick={() =>
                        setShowComponentsDropdown(!showComponentsDropdown)
                      }
                      className="px-4 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors flex items-center space-x-2"
                    >
                      <FolderOpen className="w-4 h-4" />
                      <span>Component History ({savedComponents.length})</span>
                      <ChevronDown
                        className={`w-4 h-4 transition-transform ${
                          showComponentsDropdown ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {/* Dropdown Menu */}
                    {showComponentsDropdown && (
                      <div className="absolute right-0 mt-2 w-96 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-600 z-50 max-h-96 overflow-y-auto">
                        <div className="p-4 border-b border-gray-200 dark:border-gray-600">
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-gray-900 dark:text-white">
                              Recent
                            </h3>
                            <button
                              onClick={startNewConversation}
                              className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs rounded-lg font-medium transition-colors flex items-center space-x-1"
                            >
                              <Sparkles className="w-3 h-3" />
                              <span>New</span>
                            </button>
                          </div>
                        </div>

                        {savedComponents.length === 0 ? (
                          <div className="p-6 text-center">
                            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-3">
                              <Palette className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                            </div>
                            <p className="text-gray-600 dark:text-gray-400 text-sm">
                              No components yet! Start by describing what you
                              want to build.
                            </p>
                          </div>
                        ) : (
                          <div className="max-h-80 overflow-y-auto">
                            {savedComponents.map((component) => {
                              const chatMessages = component.chat_messages
                                ? JSON.parse(component.chat_messages)
                                : [];
                              const isActive =
                                currentComponentId === component.id;

                              return (
                                <div
                                  key={component.id}
                                  className={`p-3 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                                    isActive
                                      ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700"
                                      : ""
                                  }`}
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center space-x-2 mb-1">
                                        <h4
                                          className={`font-medium text-sm truncate ${
                                            isActive
                                              ? "text-blue-700 dark:text-blue-300"
                                              : "text-gray-900 dark:text-white"
                                          }`}
                                        >
                                          {component.name}
                                        </h4>
                                        {isActive && (
                                          <span className="px-1.5 py-0.5 bg-blue-500 text-white text-xs rounded font-medium">
                                            Active
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-xs text-gray-600 dark:text-gray-300 mb-2 line-clamp-1">
                                        {component.description}
                                      </p>
                                      <div className="flex items-center space-x-3 text-xs text-gray-500 dark:text-gray-400">
                                        <span className="flex items-center space-x-1">
                                          <Globe className="w-3 h-3" />
                                          <span>
                                            {component.extracted_keys.length}
                                          </span>
                                        </span>
                                        <span className="flex items-center space-x-1">
                                          <MessageCircle className="w-3 h-3" />
                                          <span>{chatMessages.length}</span>
                                        </span>
                                        <span className="flex items-center space-x-1">
                                          <Calendar className="w-3 h-3" />
                                          <span>
                                            {new Date(
                                              component.created_at || ""
                                            ).toLocaleDateString()}
                                          </span>
                                        </span>
                                      </div>
                                    </div>
                                    <div className="flex items-center space-x-1 ml-3">
                                      <button
                                        onClick={() => {
                                          setCurrentComponent(component.code);
                                          setCurrentComponentId(component.id);
                                          setShowComponentsDropdown(false);
                                        }}
                                        className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-600 dark:hover:bg-gray-500 dark:text-gray-300 rounded font-medium transition-colors"
                                      >
                                        <Eye className="w-3 h-3" />
                                      </button>
                                      {chatMessages.length > 0 && (
                                        <button
                                          onClick={() => {
                                            loadComponentChat(component.id);
                                            setShowComponentsDropdown(false);
                                          }}
                                          className="px-2 py-1 text-xs bg-green-500 hover:bg-green-600 text-white rounded font-medium transition-colors"
                                        >
                                          <MessageCircle className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <p className="text-gray-600 dark:text-gray-400">
                Describe the React component you want to create, and I&apos;ll
                build it for you with a live preview. Components are
                automatically saved and text is extracted for localization.
                {isProcessing && (
                  <span className="ml-2 text-blue-600 font-medium flex items-center space-x-1">
                    <Cog className="w-4 h-4 animate-spin" />
                    <span>Processing component...</span>
                  </span>
                )}
              </p>

              {currentComponentId && (
                <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-700">
                  <p className="text-sm text-green-700 dark:text-green-300 flex items-center space-x-2">
                    <Target className="w-4 h-4" />
                    <span>
                      Continue working on:{" "}
                      <strong>
                        {savedComponents.find(
                          (c) => c.id === currentComponentId
                        )?.name || "Component"}
                      </strong>
                    </span>
                  </p>
                </div>
              )}
            </div>

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
