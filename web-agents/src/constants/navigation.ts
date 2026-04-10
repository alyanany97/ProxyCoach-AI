import { TabConfig, NavItem } from "@/types/navigation";

/**
 * Main navigation tabs configuration
 */
export const TABS: TabConfig[] = [
  {
    id: "basic-llm",
    label: "Basic LLM",
  },
  {
    id: "agents",
    label: "Agents",
  },
  {
    id: "feed",
    label: "Control Center",
  },
];

/**
 * Sidebar navigation items
 * Simplified to match ChatGPT style - just Search and New Chat at top
 */
export const NAV_ITEMS: NavItem[] = [
  {
    id: "search",
    label: "Search",
    icon: "search",
  },
  {
    id: "new-chat",
    label: "New Chat",
    icon: "edit",
  },
];
