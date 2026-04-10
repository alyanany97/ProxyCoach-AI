/**
 * Security utilities for Microsoft Graph API calls
 * Prevents abuse and provides audit logging
 */

interface RateLimitEntry {
   count: number;
   resetAt: number;
}

// In-memory rate limiting (in production, use Redis or similar)
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Rate limiting configuration
 */
const RATE_LIMIT_CONFIG = {
   // Maximum number of invitations per user per hour
   INVITATIONS_PER_HOUR: parseInt(process.env.GRAPH_API_RATE_LIMIT_INVITATIONS_PER_HOUR || "10", 10),
   // Maximum number of Graph API calls per user per minute
   CALLS_PER_MINUTE: parseInt(process.env.GRAPH_API_RATE_LIMIT_CALLS_PER_MINUTE || "30", 10),
   // Window in milliseconds
   HOUR_MS: 60 * 60 * 1000,
   MINUTE_MS: 60 * 1000,
};

/**
 * Check if a user has exceeded rate limits
 */
export function checkRateLimit(userId: string, action: "invite" | "api_call"): boolean {
   const now = Date.now();
   const key = `${userId}:${action}`;
   const entry = rateLimitStore.get(key);

   const limit = action === "invite" ? RATE_LIMIT_CONFIG.INVITATIONS_PER_HOUR : RATE_LIMIT_CONFIG.CALLS_PER_MINUTE;
   const window = action === "invite" ? RATE_LIMIT_CONFIG.HOUR_MS : RATE_LIMIT_CONFIG.MINUTE_MS;

   if (!entry || entry.resetAt < now) {
      // Reset or create new entry
      rateLimitStore.set(key, {
         count: 1,
         resetAt: now + window,
      });
      return true;
   }

   if (entry.count >= limit) {
      return false; // Rate limit exceeded
   }

   entry.count++;
   return true;
}

/**
 * Sanitize email input to prevent injection attacks
 */
export function sanitizeEmail(email: string): string {
   // Remove any whitespace
   const trimmed = email.trim().toLowerCase();

   // Basic email validation
   const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
   if (!emailRegex.test(trimmed)) {
      throw new Error("Invalid email format");
   }

   // Prevent email injection attacks
   const dangerousChars = /[<>'"&;|`$(){}[\]\\]/;
   if (dangerousChars.test(trimmed)) {
      throw new Error("Email contains invalid characters");
   }

   // Limit email length
   if (trimmed.length > 254) {
      throw new Error("Email address is too long");
   }

   return trimmed;
}

/**
 * Sanitize error messages to prevent information leakage
 */
export function sanitizeError(error: unknown, context: string): Error {
   if (error instanceof Error) {
      const message = error.message;

      // Don't expose sensitive information
      const sanitized = message
         .replace(/client_secret[=:]\s*[^\s&"']+/gi, "client_secret=***")
         .replace(/access_token[=:]\s*[^\s&"']+/gi, "access_token=***")
         .replace(/token[=:]\s*[^\s&"']+/gi, "token=***")
         .replace(/password[=:]\s*[^\s&"']+/gi, "password=***")
         .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "[ID_REDACTED]");

      return new Error(`Graph API error in ${context}: ${sanitized}`);
   }

   return new Error(`Graph API error in ${context}: Unknown error`);
}

/**
 * Audit log for Graph API operations
 */
export function auditLog(
   userId: string,
   action: string,
   details: Record<string, unknown>,
   success: boolean
): void {
   const logEntry = {
      timestamp: new Date().toISOString(),
      userId,
      action,
      success,
      details: {
         ...details,
         // Redact sensitive information
         email: details.email ? String(details.email).replace(/(.{2}).*(@.*)/, "$1***$2") : undefined,
      },
   };

   // In production, send to your logging service (e.g., Azure Monitor, CloudWatch, etc.)
   if (success) {
      console.info("[Graph API Audit]", JSON.stringify(logEntry));
   } else {
      console.error("[Graph API Audit]", JSON.stringify(logEntry));
   }
}

/**
 * Validate user ID format (GUID)
 */
export function validateUserId(userId: string): boolean {
   const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
   return guidRegex.test(userId);
}

/**
 * Check if email domain is allowed (optional domain whitelist)
 */
export function isDomainAllowed(email: string, allowedDomains?: string[]): boolean {
   if (!allowedDomains || allowedDomains.length === 0) {
      return true; // No restrictions
   }

   const domain = email.split("@")[1]?.toLowerCase();
   if (!domain) {
      return false;
   }

   return allowedDomains.some((allowed) => domain === allowed.toLowerCase() || domain.endsWith(`.${allowed.toLowerCase()}`));
}

/**
 * Get allowed domains from environment variable
 */
export function getAllowedDomains(): string[] {
   const envDomains = process.env.GRAPH_API_ALLOWED_DOMAINS;
   if (!envDomains) {
      return [];
   }
   return envDomains.split(",").map((d) => d.trim().toLowerCase()).filter(Boolean);
}

/**
 * Clean up old rate limit entries (run periodically)
 */
export function cleanupRateLimits(): void {
   const now = Date.now();
   for (const [key, entry] of rateLimitStore.entries()) {
      if (entry.resetAt < now) {
         rateLimitStore.delete(key);
      }
   }
}

// Clean up rate limits every 5 minutes
if (typeof setInterval !== "undefined") {
   setInterval(cleanupRateLimits, 5 * 60 * 1000);
}
