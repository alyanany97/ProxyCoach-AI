"use client";

import { ConversationListProps } from "@/types/conversation";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

/**
 * Formats a date to a relative time string
 * Handles both Date objects and date strings (from JSON serialization)
 */
function formatTimestamp(timestamp: Date | string): string {
  // Convert string to Date if needed (dates from API are serialized as strings)
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  // For older dates, show formatted date
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/**
 * Conversation Item component
 */
interface ConversationItemProps {
  conversation: ConversationListProps["conversations"][0];
  isSelected: boolean;
  onClick: () => void;
}

function ConversationItem({
  conversation,
  isSelected,
  onClick,
}: ConversationItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left",
        "px-3 py-2",
        "rounded-md",
        "transition-colors",
        "hover:bg-accent",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        isSelected && "bg-accent"
      )}
    >
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="flex items-center gap-2 mb-1">
            <h3
              className={cn(
                "text-sm font-medium break-words",
                isSelected ? "text-foreground" : "text-foreground"
              )}
            >
              {conversation.title}
            </h3>
            {conversation.unreadCount && conversation.unreadCount > 0 && (
              <span
                className={cn(
                  "flex-shrink-0",
                  "px-1.5 py-0.5",
                  "text-xs font-medium",
                  "rounded-full",
                  "bg-primary text-primary-foreground"
                )}
              >
                {conversation.unreadCount}
              </span>
            )}
          </div>
          {conversation.preview && (
            <p className="text-xs text-muted-foreground line-clamp-2 break-words">
              {conversation.preview}
            </p>
          )}
        </div>
        <span className="flex-shrink-0 text-xs text-muted-foreground whitespace-nowrap ml-auto">
          {formatTimestamp(conversation.timestamp)}
        </span>
      </div>
    </button>
  );
}

/**
 * Conversation List component
 * 
 * Displays a scrollable list of past conversations.
 * Uses shadcn/ui ScrollArea for smooth scrolling.
 */
export default function ConversationList({
  conversations,
  onSelect,
  selectedId,
}: ConversationListProps) {
  const handleSelect = (conversation: ConversationListProps["conversations"][0]) => {
    onSelect?.(conversation);
  };

  if (conversations.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <p className="text-sm text-muted-foreground text-center">
          No conversations yet
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full w-full">
      <div className="flex flex-col space-y-1 pr-2 pl-2">
        {conversations.map((conversation) => (
          <ConversationItem
            key={conversation.id}
            conversation={conversation}
            isSelected={selectedId === conversation.id}
            onClick={() => handleSelect(conversation)}
          />
        ))}
      </div>
    </ScrollArea>
  );
}


