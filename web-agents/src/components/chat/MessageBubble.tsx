"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Message } from "@/types/message";
import { User, Bot } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useSession } from "next-auth/react";
import FileAttachmentDisplay from "./FileAttachmentDisplay";

/**
 * Props for MessageBubble component
 */
interface MessageBubbleProps {
  message: Message;
  /** Shown while assistant has no content (e.g. "Thinking...", "Searching your documents...") */
  thinkingStage?: string | null;
}

/**
 * Get user initials from name or email
 */
function initials(nameOrEmail: string) {
  const parts = nameOrEmail.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const second = parts.length > 1 ? parts[parts.length - 1]?.[0] : undefined;
  return (first + (second ?? "")).toUpperCase();
}

/**
 * MessageBubble component
 * 
 * Displays a single chat message with ChatGPT-style layout:
 * - User messages: Right-aligned bubble with rounded corners
 * - Assistant messages: Full-width left-aligned messages with avatar on left
 */
export default function MessageBubble({ message, thinkingStage }: MessageBubbleProps) {
  const { data: session } = useSession();
  const [imageError, setImageError] = useState(false);
  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";

  // Get user profile image and fallback initials
  const userImage = session?.user?.image ?? "";
  const userName = session?.user?.name ?? "";
  const userEmail = session?.user?.email ?? "";
  const userInitials = initials(userEmail || userName);
  
  // Determine if we should show image or fallback
  const showImage = userImage && !imageError;

  if (isUser) {
    // User message: Right-aligned bubble (ChatGPT style)
    return (
      <div className="flex justify-end p-4 pb-2">
        <div className="flex items-end gap-2 max-w-[80%]">
          <div className="flex flex-col items-end gap-1 flex-1 min-w-0">
            <div
              className={cn(
                "rounded-2xl px-4 py-2.5",
                "bg-primary text-primary-foreground",
                "text-sm whitespace-pre-wrap break-words",
                "shadow-sm",
                "flex flex-col gap-2"
              )}
            >
              {/* File attachments */}
              {message.attachments && message.attachments.length > 0 && (
                <div className="flex flex-col gap-2 mb-2 -mx-1">
                  {message.attachments.map((attachment, index) => (
                    <FileAttachmentDisplay
                      key={index}
                      attachment={attachment}
                      variant="card"
                      showDownload={true}
                      inUserMessage={true}
                    />
                  ))}
                </div>
              )}
              {message.content || (
                <span className="opacity-70 italic">Sending...</span>
              )}
            </div>
            <span className="text-xs text-muted-foreground px-1">
              {message.timestamp instanceof Date
                ? message.timestamp.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : new Date(message.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
            </span>
          </div>
          {/* User Avatar - smaller and on the right */}
          <div
            className={cn(
              "flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center overflow-hidden",
              showImage ? "" : "bg-primary/20 text-primary border-2 border-primary/30"
            )}
          >
            {showImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img 
                src={userImage} 
                alt={userName || "User"} 
                className="h-full w-full object-cover" 
                onError={() => setImageError(true)}
              />
            ) : userInitials ? (
              <span className="text-xs font-semibold">{userInitials}</span>
            ) : (
              <User className="w-4 h-4" />
            )}
          </div>
        </div>
      </div>
    );
  }

  // Assistant message: Full-width left-aligned (ChatGPT style)
  return (
    <div className="flex gap-4 p-4 pb-2 w-full">
      {/* Assistant Avatar */}
      <div
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
          "bg-secondary text-secondary-foreground",
          "mt-1"
        )}
      >
        <Bot className="w-4 h-4" />
      </div>

      {/* Message Content - Full width */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-semibold">Assistant</span>
          <span className="text-xs text-muted-foreground">
            {message.timestamp instanceof Date
              ? message.timestamp.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : new Date(message.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
          </span>
        </div>
        <div className="text-sm whitespace-pre-wrap break-words prose prose-sm dark:prose-invert max-w-none prose-headings:mt-4 prose-headings:mb-2 prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-1">
          {message.content ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                // Custom styling for code blocks
                code({ className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || "");
                  return match ? (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  ) : (
                    <code className="bg-muted px-1.5 py-0.5 rounded text-sm" {...props}>
                      {children}
                    </code>
                  );
                },
                // Custom styling for headings
                h1: ({ children }) => <h1 className="text-xl font-bold mt-4 mb-2">{children}</h1>,
                h2: ({ children }) => <h2 className="text-lg font-semibold mt-3 mb-2">{children}</h2>,
                h3: ({ children }) => <h3 className="text-base font-semibold mt-3 mb-1">{children}</h3>,
                // Custom styling for lists
                ul: ({ children }) => <ul className="list-disc list-outside my-2 space-y-1 ml-5">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal list-outside my-2 space-y-1 ml-5">{children}</ol>,
                li: ({ children }) => <li className="pl-1">{children}</li>,
                // Custom styling for paragraphs
                p: ({ children }) => <p className="my-2">{children}</p>,
                // Custom styling for strong/bold
                strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
              }}
            >
              {message.content}
            </ReactMarkdown>
          ) : (
            <span className="text-muted-foreground italic animate-pulse">
              {thinkingStage ?? "Thinking..."}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

