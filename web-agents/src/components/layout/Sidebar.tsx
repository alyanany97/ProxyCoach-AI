"use client";

import { SidebarProps } from "@/types/layout";
import { Separator } from "@/components/ui/separator";
import ConversationList from "@/components/navigation/ConversationList";
import SidebarProfile from "@/components/auth/SidebarProfile";
import ThemeToggle from "@/components/theme/ThemeToggle";
import Logo from "@/components/theme/Logo";
import { cn } from "@/lib/utils";
import { useCallback, ReactNode } from "react";
import { Search, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GenericSidebarProps {
  className?: string;
  children?: ReactNode;
  showNewChat?: boolean;
  onNewChat?: () => void;
}

/**
 * Generic Sidebar wrapper - reusable structure
 */
export function GenericSidebar({
  className,
  children,
  showNewChat = true,
  onNewChat,
}: GenericSidebarProps) {
  return (
    <aside
      className={cn(
        "flex flex-col h-full w-full",
        "bg-background",
        "overflow-hidden",
        className
      )}
    >
      <div className={cn("flex flex-col gap-1", "p-2", "flex-shrink-0")}>
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 h-10 px-3"
          onClick={() => {
            // Search functionality - placeholder
          }}
        >
          <Search className="w-4 h-4" />
          <span>Search</span>
        </Button>

        {showNewChat && (
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 h-10 px-3"
            onClick={onNewChat}
          >
            <Pencil className="w-4 h-4" />
            <span>New Chat</span>
          </Button>
        )}
      </div>

      <Separator orientation="horizontal" className="flex-shrink-0 my-1" />

      <div className={cn("flex flex-col flex-1", "overflow-hidden", "min-h-0")}>
        {children}
      </div>

      <Separator orientation="horizontal" className="flex-shrink-0" />
      <div className="flex-shrink-0">
        <SidebarProfile />
      </div>
    </aside>
  );
}

/**
 * Sidebar component
 * 
 * ChatGPT-style sidebar with:
 * - Search and New Chat at the top
 * - Past conversations list below
 * - User profile at the bottom
 */
export default function Sidebar({
  className,
  conversations = [],
  selectedConversationId,
  onConversationSelect,
  isLoading = false,
  onNewChat,
}: SidebarProps) {
  // Handle "New Chat" button click
  const handleNewChat = useCallback(() => {
    onNewChat?.();
    onConversationSelect?.(null);
  }, [onNewChat, onConversationSelect]);

  return (
    <aside
      className={cn(
        "flex flex-col h-full w-full",
        "bg-sidebar",
        "overflow-hidden",
        className
      )}
    >
      {/* Logo at Top */}
      <div className={cn(
        "flex-shrink-0",
        "flex flex-row items-center justify-between",
        "h-[var(--header-height)]",
        "border-b border-border",
        "overflow-hidden",
        "px-4"
      )}>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-xl leading-none">🏋️</span>
          <span className="font-semibold text-sm tracking-tight truncate">ProxyCoach AI</span>
        </div>
        <ThemeToggle />
      </div>

      {/* Top Section: Search, New Chat, and Theme Toggle */}
      <div className={cn(
        "flex flex-col gap-1",
        "p-2",
        "flex-shrink-0"
      )}>
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 h-10 px-3"
          onClick={() => {
            // Search functionality - placeholder for now
          }}
        >
          <Search className="w-4 h-4" />
          <span>Search</span>
        </Button>
        
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 h-10 px-3"
          onClick={handleNewChat}
        >
          <Pencil className="w-4 h-4" />
          <span>New Chat</span>
        </Button>
      </div>

      {/* Separator */}
      <Separator orientation="horizontal" className="flex-shrink-0 my-1" />

      {/* Conversations Section */}
      <div className={cn(
        "flex flex-col flex-1",
        "overflow-hidden",
        "min-h-0"
      )}>
        {conversations.length > 0 ? (
          <ConversationList
            conversations={conversations}
            selectedId={selectedConversationId}
            onSelect={onConversationSelect}
          />
        ) : isLoading ? (
          <div className={cn(
            "flex flex-col flex-1",
            "p-4",
            "items-center justify-center"
          )}>
            <p className="text-sm text-muted-foreground">Loading conversations...</p>
          </div>
        ) : null}
      </div>

      {/* User Profile at Bottom */}
      <Separator orientation="horizontal" className="flex-shrink-0" />
      <div className="flex-shrink-0">
        <SidebarProfile />
      </div>
    </aside>
  );
}


