"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export interface Agent {
  id: string;
  name: string;
  description?: string;
}

interface AgentListProps {
  agents: Agent[];
  selectedId?: string;
  onSelect: (agent: Agent) => void;
}

/**
 * Agent Item component
 */
interface AgentItemProps {
  agent: Agent;
  isSelected: boolean;
  onClick: () => void;
}

function AgentItem({ agent, isSelected, onClick }: AgentItemProps) {
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
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-medium break-words text-foreground">
          {agent.name}
        </h3>
        {agent.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 break-words">
            {agent.description}
          </p>
        )}
      </div>
    </button>
  );
}

/**
 * Agent List component
 * 
 * Displays a scrollable list of available agents.
 */
export default function AgentList({
  agents,
  onSelect,
  selectedId,
}: AgentListProps) {
  const handleSelect = (agent: Agent) => {
    onSelect(agent);
  };

  if (agents.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <p className="text-sm text-muted-foreground text-center">
          No agents available
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full w-full">
      <div className="flex flex-col space-y-1 pr-4">
        {agents.map((agent) => (
          <AgentItem
            key={agent.id}
            agent={agent}
            isSelected={selectedId === agent.id}
            onClick={() => handleSelect(agent)}
          />
        ))}
      </div>
    </ScrollArea>
  );
}
