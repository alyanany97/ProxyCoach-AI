"use client";

import { useState, useEffect } from "react";
import { TabId } from "@/types/navigation";
import { TABS } from "@/constants/navigation";

/**
 * Hook for managing active tab state
 * 
 * Features:
 * - Manages active tab state
 * - Persists to localStorage (optional)
 * - Provides setActiveTab function
 * - Returns current active tab
 */
export function useActiveTab(initialTab?: TabId, persist = false) {
  const getInitialTab = (): TabId => {
    if (initialTab) return initialTab;
    
    if (persist && typeof window !== "undefined") {
      const saved = localStorage.getItem("activeTab");
      if (saved && TABS.some((tab) => tab.id === saved)) {
        return saved as TabId;
      }
    }
    
    return TABS[0].id;
  };

  const [activeTab, setActiveTabState] = useState<TabId>(getInitialTab);

  // Persist to localStorage if enabled
  useEffect(() => {
    if (persist && typeof window !== "undefined") {
      localStorage.setItem("activeTab", activeTab);
    }
  }, [activeTab, persist]);

  const setActiveTab = (tabId: TabId) => {
    setActiveTabState(tabId);
  };

  return {
    activeTab,
    setActiveTab,
  };
}


