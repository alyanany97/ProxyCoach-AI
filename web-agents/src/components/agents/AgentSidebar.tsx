"use client";

import { SidebarProps } from "@/types/layout";
import { Separator } from "@/components/ui/separator";
import ConversationList from "@/components/navigation/ConversationList";
import SidebarProfile from "@/components/auth/SidebarProfile";
import ThemeToggle from "@/components/theme/ThemeToggle";
import Logo from "@/components/theme/Logo";
import { cn } from "@/lib/utils";
import { useCallback } from "react";
import { Search, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Agent } from "./AgentList";

interface AgentSidebarProps {
  className?: string;
  agents: Agent[];
  selectedAgentId?: string;
  onAgentSelect: (agent: Agent | null) => void;
  conversations?: SidebarProps["conversations"];
  selectedConversationId?: string;
  onConversationSelect?: (conversation: any) => void;
  isLoading?: boolean;
  onNewChat?: () => void;
}

/**
 * Agent Sidebar component
 * 
 * Shows agents list and conversations (like basic LLM chat)
 */
export default function AgentSidebar({
  className,
  agents = [],
  selectedAgentId,
  onAgentSelect,
  conversations = [],
  selectedConversationId,
  onConversationSelect,
  isLoading = false,
  onNewChat,
}: AgentSidebarProps) {
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
        <Logo className="flex-1" />
        <ThemeToggle />
      </div>

      {/* Top Section: Search and New Chat */}
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

      {/* Agent Selection Dropdown */}
      <div className={cn(
        "flex flex-col",
        "px-2 py-2",
        "flex-shrink-0"
      )}>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase px-2 py-1 mb-2">
          Select Agent
        </h2>
        <Select
          value={selectedAgentId || ""}
          onValueChange={(value) => {
            const agent = agents.find(a => a.id === value) || null;
            onAgentSelect(agent);
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Choose an agent..." />
          </SelectTrigger>
          <SelectContent>
            {agents.map((agent) => (
              <SelectItem key={agent.id} value={agent.id}>
                {agent.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
