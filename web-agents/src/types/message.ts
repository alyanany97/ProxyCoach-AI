/**
 * Message role types for chat
 */
export type MessageRole = "user" | "assistant" | "system";

/**
 * File attachment structure
 */
export interface FileAttachment {
  id?: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileUrl?: string;
  dataUrl?: string; // Base64 data URL for client-side preview
  extractedText?: string; // Extracted text content for document files (PDF, Excel, Word, CSV)
}

/**
 * Chat message structure
 */
export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  attachments?: FileAttachment[];
}

/**
 * Streaming chunk structure
 */
export interface StreamChunk {
  content: string;
  done: boolean;
}

