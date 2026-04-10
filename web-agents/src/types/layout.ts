import { ReactNode } from "react";

/**
 * Props for the AppLayout component
 */
export interface AppLayoutProps {
  children: ReactNode;
}

import { TabId } from "./navigation";
import { Conversation } from "./conversation";

/**
 * Props for the TabNavigation component
 */
export interface TabNavigationProps {
  activeTab?: TabId | string;
  onTabChange?: (tabId: TabId | string) => void;
}

/**
 * Props for the Sidebar component
 */
export interface SidebarProps {
  className?: string;
  conversations?: Conversation[];
  selectedConversationId?: string;
  onConversationSelect?: (conversation: Conversation | null) => void;
  isLoading?: boolean;
  onNewChat?: () => void;
}


