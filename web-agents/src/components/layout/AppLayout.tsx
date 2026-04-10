import { AppLayoutProps } from "@/types/layout";
import { cn } from "@/lib/utils";
import TabNavigation from "./TabNavigation";
import Sidebar from "./Sidebar";

/**
 * Main application layout component
 * 
 * Structure:
 * - Sidebar on the left (fixed width)
 * - Right column contains:
 *   - TabNavigation at the top (spans only right area)
 *   - ChatScreen below tabs (takes remaining space)
 * 
 * Responsive:
 * - Desktop: Full layout with sidebar visible
 * - Mobile: Sidebar hidden (will be handled in Phase 9)
 */
export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className={cn(
      "flex flex-row h-screen w-full overflow-hidden",
      "bg-background text-foreground"
    )}>
      {/* Left Sidebar Area */}
      <aside className={cn(
        "flex-shrink-0",
        "w-64 lg:w-72",
        "border-r border-border",
        "bg-sidebar",
        "overflow-hidden"
      )}>
        <Sidebar />
      </aside>

      {/* Right Column: TabNavigation + Main Content */}
      <div className={cn(
        "flex flex-col flex-1 overflow-hidden"
      )}>
        {/* Tab Navigation Area - starts after sidebar */}
        <div className={cn(
          "flex-shrink-0 w-full",
          "border-b border-border"
        )}>
          <TabNavigation />
        </div>

        {/* Main Content Area */}
        <main className={cn(
          "flex-1",
          "overflow-hidden",
          "bg-background"
        )}>
          {children}
        </main>
      </div>
    </div>
  );
}


