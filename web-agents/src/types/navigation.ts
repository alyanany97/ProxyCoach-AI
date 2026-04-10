import { ReactNode } from "react";

/**
 * Tab identifier type for the main navigation tabs
 */
export type TabId = "basic-llm" | "agents" | "feed";

/**
 * Configuration for a navigation tab
 */
export interface TabConfig {
  id: TabId;
  label: string;
}

/**
 * Navigation item for the sidebar
 */
export interface NavItem {
  id: string;
  label: string;
  icon?: ReactNode;
  href?: string;
  onClick?: () => void;
}
