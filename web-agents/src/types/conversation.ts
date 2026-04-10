/**
 * Conversation data structure
 * Note: timestamp can be Date or string (from JSON serialization)
 */
export interface Conversation {
  id: string;
  title: string;
  timestamp: Date | string; // Can be Date object or ISO string from API
  preview?: string;
  unreadCount?: number;
}

/**
 * Props for the ConversationList component
 */
export interface ConversationListProps {
  conversations: Conversation[];
  onSelect?: (conversation: Conversation) => void;
  selectedId?: string;
}
