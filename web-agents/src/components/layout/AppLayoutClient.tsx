"use client";

import { useState, useEffect } from "react";
import { useActiveTab } from "@/hooks/useActiveTab";
import { useConversations } from "@/hooks/useConversations";
import { TabId } from "@/types/navigation";
import { Conversation } from "@/types/conversation";
import TabNavigation from "./TabNavigation";
import Sidebar from "./Sidebar";
import ChatScreen from "@/components/chat/ChatScreen";
import AgentSidebar from "@/components/agents/AgentSidebar";
import AgentChatScreen from "@/components/agents/AgentChatScreen";
import { Agent } from "@/components/agents/AgentList";
import { AGENTS } from "@/constants/agents";
import { cn } from "@/lib/utils";

/**
 * Client wrapper for AppLayout that manages state
 * 
 * This component handles:
 * - Active tab state
 * - Conversation selection state
 * - Passes state to child components
 * - Renders the complete layout structure
 */
export default function AppLayoutClient() {
  // Track if component has mounted on client to prevent hydration mismatch
  const [mounted, setMounted] = useState(false);
  
  const { activeTab, setActiveTab } = useActiveTab(undefined, false);
  // Agent selection state
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  // Separate conversation hooks for basic LLM and agents
  const { conversations: basicLLMConversations, selectedConversation: basicLLMSelectedConversation, isLoading: basicLLMIsLoading, selectConversation: selectBasicLLMConversation, loadConversations: loadBasicLLMConversations, clearConversations: clearBasicLLMConversations } = useConversations();
  const { conversations: agentConversations, selectedConversation: agentSelectedConversation, isLoading: agentIsLoading, selectConversation: selectAgentConversation, loadConversations: loadAgentConversations, clearConversations: clearAgentConversations } = useConversations();
  
  // Set mounted to true after client-side hydration
  useEffect(() => {
    setMounted(true);
  }, []);
  
  // Use appropriate conversations based on active tab
  const conversations = activeTab === "basic-llm" ? basicLLMConversations : agentConversations;
  const selectedConversation = activeTab === "basic-llm" ? basicLLMSelectedConversation : agentSelectedConversation;
  const isLoading = activeTab === "basic-llm" ? basicLLMIsLoading : agentIsLoading;
  const selectConversation = activeTab === "basic-llm" ? selectBasicLLMConversation : selectAgentConversation;
  const loadConversations = activeTab === "basic-llm" ? loadBasicLLMConversations : loadAgentConversations;

  /**
   * Handle conversation selection change from ChatScreen
   */
  const handleConversationSelect = async (conversationId: string | null) => {
    if (conversationId) {
      let conversation = conversations.find((c) => c.id === conversationId);
      if (!conversation) {
        // Conversation was just created, reload list with correct context
        let updatedConversations: Conversation[];
        if (activeTab === "basic-llm") {
          updatedConversations = await loadBasicLLMConversations(null);
        } else if (activeTab === "agents" && selectedAgent) {
          updatedConversations = await loadAgentConversations(selectedAgent.id);
        } else {
          updatedConversations = [];
        }
        conversation = updatedConversations.find((c) => c.id === conversationId);
        if (conversation) {
          selectConversation(conversation);
        }
      } else {
        selectConversation(conversation);
      }
    } else {
      selectConversation(null);
    }
  };
  
  /**
   * Handle conversation selection from Sidebar
   */
  const handleSidebarSelect = (conversation: Conversation | null) => {
    selectConversation(conversation);
  };

  /**
   * Handle new conversation (clear selection)
   */
  const handleNewConversation = () => {
    selectConversation(null);
  };

  /**
   * Handle agent selection change - reload conversations for that agent
   */
  const handleAgentSelect = async (agent: Agent | null) => {
    setSelectedAgent(agent);
    // Clear selected conversation when switching agents
    selectAgentConversation(null);
    // Load conversations for the selected agent
    if (activeTab === "agents" && agent) {
      await loadAgentConversations(agent.id);
    } else if (activeTab === "agents" && !agent) {
      // Clear conversations when no agent is selected
      clearAgentConversations();
    }
  };
  
  // Handle tab changes - load filtered conversations when switching tabs
  useEffect(() => {
    if (!mounted) return;
    
    if (activeTab === "agents") {
      // Clear agent conversation selection when switching to agents tab
      selectAgentConversation(null);
      if (selectedAgent) {
        // Load conversations for the selected agent (filtered on database side)
        loadAgentConversations(selectedAgent.id);
      } else {
        // Clear conversations when no agent is selected
        clearAgentConversations();
      }
    } else if (activeTab === "basic-llm") {
      // Clear basic LLM conversation selection when switching to basic-llm tab
      selectBasicLLMConversation(null);
      // Load basic LLM conversations (agentId is null, filtered on database side)
      loadBasicLLMConversations(null);
    }
  }, [mounted, activeTab, selectedAgent, loadAgentConversations, loadBasicLLMConversations, clearAgentConversations, selectAgentConversation, selectBasicLLMConversation]);

  // Prevent hydration mismatch by only rendering after client mount
  // This ensures Radix UI components generate consistent IDs
  if (!mounted) {
    return (
      <div className={cn(
        "flex flex-row h-screen w-full overflow-hidden",
        "bg-background text-foreground"
      )}>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex flex-row h-screen w-full overflow-hidden",
      "bg-background text-foreground"
    )}>
      {/* Left Sidebar Area - Always visible */}
      <aside className={cn(
        "flex-shrink-0",
        "w-64 lg:w-72",
        "border-r border-border",
        "bg-sidebar",
        "overflow-hidden"
      )}>
        {activeTab === "basic-llm" ? (
          <Sidebar
            conversations={conversations}
            selectedConversationId={selectedConversation?.id}
            onConversationSelect={handleSidebarSelect}
            isLoading={isLoading}
            onNewChat={handleNewConversation}
          />
        ) : activeTab === "agents" ? (
          <AgentSidebar
            agents={AGENTS}
            selectedAgentId={selectedAgent?.id}
            onAgentSelect={handleAgentSelect}
            conversations={agentConversations}
            selectedConversationId={agentSelectedConversation?.id}
            onConversationSelect={handleSidebarSelect}
            isLoading={agentIsLoading}
            onNewChat={handleNewConversation}
          />
        ) : (
          <Sidebar
            conversations={[]}
            selectedConversationId={undefined}
            onConversationSelect={handleSidebarSelect}
            isLoading={false}
            onNewChat={handleNewConversation}
          />
        )}
      </aside>

      {/* Right Column: TabNavigation + Main Content */}
      <div className={cn(
        "flex flex-col flex-1 overflow-hidden"
      )}>
        {/* Tab Navigation Area - starts after sidebar */}
        <TabNavigation
          activeTab={activeTab}
          onTabChange={(tabId) => setActiveTab(tabId as TabId)}
        />

        {/* Main Content Area */}
        <main className={cn(
          "flex-1",
          "overflow-hidden",
          "bg-background"
        )}>
          {activeTab === "basic-llm" ? (
            <ChatScreen
              activeTab={activeTab}
              selectedConversation={selectedConversation}
              onConversationChange={handleConversationSelect}
              onNewConversation={handleNewConversation}
              onTitleUpdate={() => loadBasicLLMConversations(null)}
            />
          ) : activeTab === "agents" ? (
            <AgentChatScreen
              selectedAgent={selectedAgent}
              selectedConversation={selectedConversation}
              onConversationChange={handleConversationSelect}
              onNewConversation={handleNewConversation}
              onTitleUpdate={() => selectedAgent ? loadAgentConversations(selectedAgent.id) : clearAgentConversations()}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center space-y-4">
                <h2 className="text-2xl font-semibold text-foreground">
                  Feature Coming Soon
                </h2>
                <p className="text-muted-foreground max-w-md">
                  This feature is under development. Please check back later!
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}


