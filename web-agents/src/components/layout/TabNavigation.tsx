"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TABS } from "@/constants/navigation";
import { TabNavigationProps } from "@/types/layout";
import { TabId } from "@/types/navigation";
import { cn } from "@/lib/utils";

/**
 * Tab Navigation component
 * 
 * Displays the main navigation tabs at the top of the application.
 * 
 * Styling:
 * - Active tab: Primary brand color background, white text
 * - Inactive tabs: Background color, foreground text
 * - Full width horizontal bar
 * - No rounded corners
 */
export default function TabNavigation({
  activeTab,
  onTabChange,
}: TabNavigationProps) {
  // Default to first tab if no activeTab provided
  const [internalActiveTab, setInternalActiveTab] = useState<TabId>(
    (activeTab as TabId) || TABS[0].id
  );

  const currentTab = activeTab || internalActiveTab;

  const handleTabChange = (value: string) => {
    const tabId = value as TabId;
    setInternalActiveTab(tabId);
    onTabChange?.(tabId);
  };

  return (
    <div className="flex-shrink-0 w-full h-[var(--header-height)] bg-background border-b border-border">
      <Tabs
        value={currentTab}
        onValueChange={handleTabChange}
        className="w-full h-full"
        suppressHydrationWarning
      >
        <TabsList
          className={cn(
            "w-full h-full",
            "bg-transparent p-0",
            "rounded-none border-0",
            "justify-start items-stretch",
            "gap-0"
          )}
        >
          {TABS.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className={cn(
                "flex-1 h-full",
                "rounded-none border-0",
                "px-6 py-3",
                "text-sm font-medium",
                "transition-colors duration-200",
                "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground",
                "data-[state=inactive]:bg-background data-[state=inactive]:text-foreground",
                "hover:bg-accent data-[state=active]:hover:bg-primary",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              )}
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}


