/**
 * Session management utilities
 * 
 * For anonymous users, we use localStorage to store a session ID.
 * For logged-in users, conversations are linked to their userId.
 */

const SESSION_ID_KEY = "chat_session_id";

/**
 * Get or create a session ID
 * Stores in localStorage for persistence across page refreshes
 */
export function getSessionId(): string {
  if (typeof window === "undefined") {
    // Server-side: generate a new ID (not ideal, but works for API routes)
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Client-side: use localStorage
  let sessionId = localStorage.getItem(SESSION_ID_KEY);
  
  if (!sessionId) {
    // Generate a new session ID
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem(SESSION_ID_KEY, sessionId);
  }
  
  return sessionId;
}

/**
 * Clear the session (useful for logout in the future)
 */
export function clearSession(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(SESSION_ID_KEY);
  }
}

