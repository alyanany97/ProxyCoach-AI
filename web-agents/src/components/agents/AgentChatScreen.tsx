"use client";

import { useRef, useEffect, useState, DragEvent } from "react";
import { cn } from "@/lib/utils";
import { Conversation } from "@/types/conversation";
import { useAgentChat } from "@/hooks/useAgentChat";
import { ScrollArea } from "@/components/ui/scroll-area";
import MessageBubble from "@/components/chat/MessageBubble";
import ChatInput, { ChatInputRef } from "@/components/chat/ChatInput";
import DropOverlay from "@/components/chat/DropOverlay";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Agent } from "./AgentList";

/**
 * Props for the AgentChatScreen component
 */
interface AgentChatScreenProps {
  className?: string;
  selectedAgent: Agent | null;
  selectedConversation?: Conversation | null;
  onConversationChange?: (conversationId: string | null) => void;
  onNewConversation?: () => void;
  onTitleUpdate?: () => void;
}

/**
 * Agent Chat Screen component
 * 
 * Behaves exactly like ChatScreen but uses agent-specific API endpoint.
 * Handles conversations, message persistence, file uploads, and streaming.
 */
export default function AgentChatScreen({
  className,
  selectedAgent,
  selectedConversation,
  onConversationChange,
  onNewConversation,
  onTitleUpdate,
}: AgentChatScreenProps) {
  const handleConversationChange = (id: string | null) => {
    onConversationChange?.(id);
  };

  const { messages, isLoading, error, thinkingStage, conversationId, sendMessage, clearMessages, cancelStream, loadMessages } = useAgentChat(
    selectedAgent?.id || null,
    selectedConversation?.id || null,
    handleConversationChange,
    onTitleUpdate
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<ChatInputRef>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  /**
   * Validate if a file type is acceptable
   */
  const isValidFileType = (file: File): boolean => {
    const isImage = file.type.startsWith("image/");
    const isDocument = 
      file.type === "application/pdf" ||
      file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.type === "application/vnd.ms-excel" ||
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      file.type === "text/csv" ||
      file.name.endsWith(".pdf") ||
      file.name.endsWith(".xlsx") ||
      file.name.endsWith(".xls") ||
      file.name.endsWith(".docx") ||
      file.name.endsWith(".csv");
    
    return isImage || isDocument;
  };

  /**
   * Handle drag over event
   */
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isLoading) {
      // Check if dragging files
      if (e.dataTransfer.types.includes("Files")) {
        setIsDragOver(true);
      }
    }
  };

  /**
   * Handle drag leave event
   */
  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set drag over to false if we're actually leaving the chat screen
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsDragOver(false);
    }
  };

  /**
   * Handle drop event
   */
  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (isLoading) return;

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    // Validate files
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    const validFiles: File[] = [];
    const invalidFiles: string[] = [];

    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_SIZE) {
        invalidFiles.push(`"${file.name}" is too large (max 10MB)`);
        continue;
      }
      if (!isValidFileType(file)) {
        invalidFiles.push(`"${file.name}" is not supported`);
        continue;
      }
      validFiles.push(file);
    }

    // Show errors for invalid files
    if (invalidFiles.length > 0) {
      if (invalidFiles.length === 1) {
        toast.error(invalidFiles[0]);
      } else {
        toast.error(`${invalidFiles.length} files could not be added. ${invalidFiles.slice(0, 3).join(", ")}${invalidFiles.length > 3 ? "..." : ""}`);
      }
    }

    // Add valid files to ChatInput
    if (validFiles.length > 0 && chatInputRef.current) {
      await chatInputRef.current.addFiles(validFiles);
    }
  };

  /**
   * Auto-scroll to bottom when new messages arrive
   */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!selectedAgent) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-semibold text-foreground">
            Select an Agent
          </h2>
          <p className="text-muted-foreground max-w-md">
            Choose an agent from the sidebar to start chatting.
          </p>
        </div>
      </div>
    );
  }

  const hasMessages = messages.length > 0;

  return (
    <div
      className={cn(
        "flex flex-col h-full w-full",
        "bg-background",
        "overflow-hidden",
        "relative",
        className
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <DropOverlay isVisible={isDragOver} />
      {hasMessages ? (
        <>
          {/* Chat Messages Area - When there are messages */}
          <ScrollArea className="flex-1">
            <div className="flex flex-col">
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  thinkingStage={message.role === "assistant" && !message.content ? thinkingStage : null}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Error Display */}
          {error && (
            <div className="px-4 py-2 bg-destructive/10 border-t border-destructive/20">
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="w-4 h-4" />
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* Chat Input Area - At bottom when messages exist */}
          <ChatInput
            ref={chatInputRef}
            onSend={sendMessage}
            isLoading={isLoading}
            onCancel={cancelStream}
            disabled={false}
          />
        </>
      ) : (
        <>
          {/* Empty State - Centered with input in middle */}
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            <div className="text-center space-y-6 max-w-2xl w-full">
              <div className="space-y-2">
                <h1 className="text-4xl font-semibold text-foreground">{selectedAgent.name}</h1>
                {selectedAgent.description && (
                  <p className="text-muted-foreground">{selectedAgent.description}</p>
                )}
              </div>
              
              {/* Centered Input - ChatGPT style */}
              <div className="w-full max-w-3xl mx-auto">
                <ChatInput
                  ref={chatInputRef}
                  onSend={sendMessage}
                  isLoading={isLoading}
                  onCancel={cancelStream}
                  disabled={false}
                  variant="centered"
                />
              </div>

              {/* Error Display */}
              {error && (
                <div className="px-4 py-2 bg-destructive/10 rounded-md">
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <AlertCircle className="w-4 h-4" />
                    <span>{error}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
