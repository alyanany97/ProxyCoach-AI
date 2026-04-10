"use client";

import { useState, useCallback } from "react";
import { Conversation } from "@/types/conversation";
import { getSessionId } from "@/lib/session";

/**
 * Hook for managing conversations state
 * 
 * Features:
 * - Manages conversations list
 * - Manages selected conversation
 * - Provides functions to select conversations
 * - Loads conversations from database
 */
export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Load conversations from database
   * @param agentId - Optional agent ID to filter conversations. If null, loads basic LLM conversations. If undefined, loads all conversations.
   */
  const loadConversations = useCallback(async (agentId?: string | null): Promise<Conversation[]> => {
    try {
      setIsLoading(true);
      const sessionId = getSessionId();
      const url = new URL("/api/conversations", window.location.origin);
      url.searchParams.set("sessionId", sessionId);
      if (agentId !== undefined) {
        url.searchParams.set("agentId", agentId || "");
      }
      const response = await fetch(url.toString());

      if (!response.ok) {
        throw new Error("Failed to load conversations");
      }

      const data = await response.json();
      const conversationsList = data || [];
      setConversations(conversationsList);
      return conversationsList;
    } catch (error) {
      console.error("Error loading conversations:", error);
      setConversations([]);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Select a conversation
   */
  const selectConversation = useCallback((conversation: Conversation | null) => {
    setSelectedConversation(conversation);
  }, []);

  /**
   * Delete a conversation
   */
  const deleteConversation = useCallback(async (conversationId: string) => {
    try {
      const sessionId = getSessionId();
      const response = await fetch(`/api/conversations/${conversationId}`, {
        method: "DELETE",
        headers: {
          "x-session-id": sessionId,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to delete conversation");
      }

      // Remove from list
      setConversations((prev) => prev.filter((conv) => conv.id !== conversationId));
      
      // Clear selection if deleted conversation was selected
      if (selectedConversation?.id === conversationId) {
        setSelectedConversation(null);
      }
    } catch (error) {
      console.error("Error deleting conversation:", error);
    }
  }, [selectedConversation]);

  /**
   * Clear conversations list
   */
  const clearConversations = useCallback(() => {
    setConversations([]);
    setSelectedConversation(null);
  }, []);

  return {
    conversations,
    selectedConversation,
    isLoading,
    selectConversation,
    loadConversations,
    deleteConversation,
    clearConversations,
  };
}


