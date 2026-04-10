import AppLayoutClient from "@/components/layout/AppLayoutClient";
import HideBehindAuth from "@/components/auth/HideBehindAuth";

/**
 * Main landing page
 * 
 * Uses AppLayoutClient which manages state and provides:
 * - TabNavigation (top)
 * - Sidebar (left)
 * - ChatScreen (right)
 */
export default function Home() {
  return (
    <HideBehindAuth callbackUrl="/">
      <AppLayoutClient />
    </HideBehindAuth>
  );
}
