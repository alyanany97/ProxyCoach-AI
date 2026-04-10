"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Message, MessageRole, FileAttachment } from "@/types/message";
import { getSessionId } from "@/lib/session";

/**
 * Hook for managing chat messages and streaming
 * 
 * Features:
 * - Manages messages state
 * - Handles streaming responses from API
 * - Saves messages to database
 * - Loads messages from database when conversation is selected
 * - Provides functions to send messages
 * - Manages loading states
 */
export function useChat(conversationId?: string | null, onConversationChange?: (id: string | null) => void, onTitleUpdate?: () => void) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(conversationId || null);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Load messages for a conversation
   */
  const loadMessages = useCallback(async (convId: string) => {
    try {
      const sessionId = getSessionId();
      const response = await fetch(`/api/conversations/${convId}?sessionId=${sessionId}`);
      
      if (!response.ok) {
        throw new Error("Failed to load conversation");
      }

      const data = await response.json();
      // Ensure timestamps are Date objects
      const formattedMessages: Message[] = (data.messages || []).map((msg: any) => ({
        ...msg,
        timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
      }));
      setMessages(formattedMessages);
      setCurrentConversationId(convId);
    } catch (error) {
      console.error("Error loading messages:", error);
      setMessages([]);
    }
  }, []);

  /**
   * Create a new conversation
   */
  const createConversation = useCallback(async (skipCallback = false): Promise<string> => {
    try {
      const sessionId = getSessionId();
      const response = await fetch("/api/conversations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sessionId, title: "New Conversation" }),
      });

      if (!response.ok) {
        throw new Error("Failed to create conversation");
      }

      const conversation = await response.json();
      setCurrentConversationId(conversation.id);
      // Only notify parent if we're not in the middle of sending a message
      if (!skipCallback) {
        onConversationChange?.(conversation.id);
      }
      return conversation.id;
    } catch (error) {
      console.error("Error creating conversation:", error);
      throw error;
    }
  }, [onConversationChange]);

  /**
   * Save a message to the database
   */
  const saveMessage = useCallback(async (
    convId: string,
    role: MessageRole,
    content: string,
    updateTitle = false,
    attachments?: FileAttachment[]
  ) => {
    try {
      const sessionId = getSessionId();
      await fetch(`/api/conversations/${convId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": sessionId,
        },
        body: JSON.stringify({ role, content, updateTitle, attachments }),
      });
    } catch (error) {
      console.error("Error saving message:", error);
      // Don't throw - we still want the message to show even if save fails
    }
  }, []);

  // Load messages when conversationId changes (but not if we're currently loading/sending)
  useEffect(() => {
    // Don't reload messages if we're currently sending a message or loading
    if (isLoading) {
      return;
    }
    
    // Don't reload if we already have messages and the conversation hasn't changed
    if (messages.length > 0 && conversationId === currentConversationId) {
      return;
    }
    
    // Don't reload if conversationId is null but we're already on null (new chat state)
    if (!conversationId && !currentConversationId) {
      return;
    }
    
    if (conversationId && conversationId !== currentConversationId) {
      loadMessages(conversationId);
    } else if (!conversationId && currentConversationId) {
      // New chat - clear messages only if we had a previous conversation
      setMessages([]);
      setCurrentConversationId(null);
    }
  }, [conversationId, currentConversationId, loadMessages, isLoading, messages.length]);

  /**
   * Generate a unique ID for messages
   */
  const generateId = useCallback(() => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  /**
   * Upload files to blob storage
   */
  const uploadFiles = useCallback(async (files: File[], conversationId: string): Promise<FileAttachment[]> => {
    const uploadedAttachments: FileAttachment[] = [];

    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("conversationId", conversationId);

        const response = await fetch("/api/files/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Failed to upload file" }));
          throw new Error(errorData.error || "Failed to upload file");
        }

        const data = await response.json();
        console.log(`[useChat] Upload response for ${data.fileName}:`, {
          fileName: data.fileName,
          fileType: data.fileType,
          hasExtractedText: !!data.extractedText,
          extractedTextLength: data.extractedText?.length || 0,
        });
        
        uploadedAttachments.push({
          fileName: data.fileName,
          fileType: data.fileType,
          fileSize: data.fileSize,
          fileUrl: data.blobUrl, // Store blob URL
          extractedText: data.extractedText, // Store extracted text for document files
        });
      } catch (error) {
        console.error("Error uploading file:", error);
        throw error;
      }
    }

    return uploadedAttachments;
  }, []);

  /**
   * Send a message and stream the response
   */
  const sendMessage = useCallback(async (content: string, files?: File[]) => {
    // Allow sending if there's text OR files
    if ((!content.trim() && (!files || files.length === 0)) || isLoading) return;

    setError(null);
    setIsLoading(true);

    // Get or create conversation ID
    let convId = currentConversationId;
    if (!convId) {
      try {
        // Skip callback in createConversation to prevent reloading messages while sending
        // We'll notify parent manually after setting up the conversation state
        convId = await createConversation(true);
        // Notify parent - this updates the prop, but useEffect won't reload because isLoading is true
        onConversationChange?.(convId);
      } catch (error) {
        setError("Failed to create conversation");
        setIsLoading(false);
        return;
      }
    }

    // Upload files to blob storage if any
    let uploadedAttachments: FileAttachment[] | undefined;
    if (files && files.length > 0) {
      try {
        uploadedAttachments = await uploadFiles(files, convId);
      } catch (error) {
        setError(error instanceof Error ? error.message : "Failed to upload files");
        setIsLoading(false);
        return;
      }
    }

    // Create user message
    const userMessage: Message = {
      id: generateId(),
      role: "user",
      content: content.trim(),
      timestamp: new Date(),
      attachments: uploadedAttachments,
    };

    // Check if this is the first message before adding it
    const isFirstMessage = messages.length === 0;

    // Add user message to chat
    setMessages((prev) => [...prev, userMessage]);

    // Save user message to database (first message updates title)
    await saveMessage(convId, "user", userMessage.content, isFirstMessage, userMessage.attachments);
    
    // Notify parent to refresh conversations list if this is the first message (title update)
    if (isFirstMessage) {
      onTitleUpdate?.();
    }

    // Create assistant message placeholder
    const assistantMessageId = generateId();
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, assistantMessage]);

    // Abort controller for cancelling requests
    abortControllerRef.current = new AbortController();

    try {
      // Prepare messages for API (excluding empty assistant message)
      // Include attachments for messages that have them
      // For Azure OpenAI Vision API, we need to convert blob URLs to the format it expects
      const messagesForAPI = [...messages, userMessage].map((msg) => {
        const apiMessage: {
          role: string;
          content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
          attachments?: FileAttachment[];
        } = {
          role: msg.role,
          content: msg.content,
          attachments: msg.attachments,
        };

        // If message has image attachments, format for Vision API
        if (msg.attachments && msg.attachments.length > 0) {
          const imageAttachments = msg.attachments.filter(att => att.fileType.startsWith("image/"));
          if (imageAttachments.length > 0) {
            const contentArray: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];
            
            // Add text content if present
            if (msg.content.trim()) {
              contentArray.push({ type: "text", text: msg.content });
            }

            // Add image URLs
            for (const image of imageAttachments) {
              if (image.fileUrl) {
                contentArray.push({
                  type: "image_url",
                  image_url: { url: image.fileUrl },
                });
              }
            }

            apiMessage.content = contentArray;
          }
        }

        return apiMessage;
      });

      // Log the messages being sent to API for debugging
      console.log(`[useChat] Sending ${messagesForAPI.length} message(s) to API`);
      const lastMessage = messagesForAPI[messagesForAPI.length - 1];
      if (lastMessage.attachments && lastMessage.attachments.length > 0) {
        console.log(`[useChat] Last message has ${lastMessage.attachments.length} attachment(s):`);
        lastMessage.attachments.forEach((att, idx) => {
          console.log(`[useChat]   Attachment ${idx + 1}: ${att.fileName}, type: ${att.fileType}, has extractedText: ${!!att.extractedText}, extractedText length: ${att.extractedText?.length || 0}`);
        });
      }

      // Stream response from API
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages: messagesForAPI }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Failed to parse error" }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      // Read the stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No reader available");
      }

      let accumulatedContent = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.error) {
                throw new Error(data.error);
              }

              if (data.content) {
                accumulatedContent += data.content;
                // Update the assistant message with accumulated content
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessageId
                      ? { ...msg, content: accumulatedContent }
                      : msg
                  )
                );
              }

              if (data.done) {
                // Save assistant message to database when streaming is complete
                if (accumulatedContent && convId) {
                  await saveMessage(convId, "assistant", accumulatedContent, false);
                  // Notify parent to refresh conversations list (for title updates)
                  onTitleUpdate?.();
                }
                setIsLoading(false);
                return;
              }
            } catch (parseError) {
              // Skip malformed JSON lines
              console.warn("Failed to parse SSE data:", parseError);
            }
          }
        }
      }

      setIsLoading(false);
    } catch (error) {
      // Don't set error if it was an abort
      if (error instanceof Error && error.name === "AbortError") {
        setIsLoading(false);
        return;
      }

      setError(error instanceof Error ? error.message : "An error occurred");
      setIsLoading(false);

      // Remove the assistant message if there was an error
      setMessages((prev) => prev.filter((msg) => msg.id !== assistantMessageId));
    }
  }, [messages, isLoading, generateId, currentConversationId, createConversation, saveMessage, onTitleUpdate]);

  /**
   * Clear all messages (starts new chat)
   */
  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
    setIsLoading(false);
    setCurrentConversationId(null);
    onConversationChange?.(null);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, [onConversationChange]);

  /**
   * Cancel current streaming request
   */
  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    messages,
    isLoading,
    error,
    conversationId: currentConversationId,
    sendMessage,
    clearMessages,
    cancelStream,
    loadMessages,
  };
}

