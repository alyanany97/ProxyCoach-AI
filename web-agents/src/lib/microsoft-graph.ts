/**
 * Microsoft Graph API utilities for managing guest users and app assignments
 */

import {
   checkRateLimit,
   sanitizeEmail,
   sanitizeError,
   auditLog,
   validateUserId,
   isDomainAllowed,
   getAllowedDomains,
} from "./graph-api-security";

function requiredEnv(name: string): string {
   const value = process.env[name];
   // During Next.js build phase, env vars might not be available
   // Allow empty string during build - validation happens at runtime when function is called
   if (!value && process.env.NEXT_PHASE !== "phase-production-build") {
      throw new Error(`Missing required env var: ${name}`);
   }
   // Return empty string during build - will be validated when function is actually called
   return value || "";
}

/**
 * Get an access token for Microsoft Graph API using client credentials flow
 */
async function getGraphAccessToken(): Promise<string> {
   const tenantId = requiredEnv("AUTH_MICROSOFT_ENTRA_ID_TENANT_ID");
   const clientId = requiredEnv("AUTH_MICROSOFT_ENTRA_ID_CLIENT_ID");
   const clientSecret = requiredEnv("AUTH_MICROSOFT_ENTRA_ID_CLIENT_SECRET");

   // Validate at runtime (when function is called, not during build)
   if (!tenantId || !clientId || !clientSecret) {
      throw new Error("Missing required Microsoft Entra ID environment variables for Graph API");
   }

   const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

   const response = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
         "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
         client_id: clientId,
         client_secret: clientSecret,
         scope: "https://graph.microsoft.com/.default",
         grant_type: "client_credentials",
      }),
   });

   if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get access token: ${response.status} ${errorText}`);
   }

   const data = await response.json();
   return data.access_token;
}

/**
 * Get access token (exported for use in other functions)
 */
export async function getGraphAccessTokenPublic(): Promise<string> {
   return getGraphAccessToken();
}

/**
 * Check if a user exists in the tenant
 * Security: Input is sanitized before use in query
 */
async function userExistsInTenant(
   email: string,
   accessToken: string,
   userId: string
): Promise<{ exists: boolean; userId?: string }> {
   // Rate limiting
   if (!checkRateLimit(userId, "api_call")) {
      throw new Error("Rate limit exceeded. Please try again later.");
   }

   // Sanitize email to prevent injection
   const sanitizedEmail = sanitizeEmail(email);

   // URL encode the email to prevent injection in OData filter
   const encodedEmail = encodeURIComponent(sanitizedEmail);
   const userSearchEndpoint = `https://graph.microsoft.com/v1.0/users?$filter=mail eq '${encodedEmail}' or userPrincipalName eq '${encodedEmail}' or otherMails/any(x:x eq '${encodedEmail}')`;

   try {
      const response = await fetch(userSearchEndpoint, {
         headers: {
            Authorization: `Bearer ${accessToken}`,
         },
         // Add timeout to prevent hanging requests
         signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (!response.ok) {
         auditLog(userId, "user_exists_check", { email: sanitizedEmail }, false);
         return { exists: false };
      }

      const data = await response.json();
      if (data.value && data.value.length > 0) {
         auditLog(userId, "user_exists_check", { email: sanitizedEmail, found: true }, true);
         return { exists: true, userId: data.value[0].id };
      }

      auditLog(userId, "user_exists_check", { email: sanitizedEmail, found: false }, true);
      return { exists: false };
   } catch (error) {
      const sanitized = sanitizeError(error, "userExistsInTenant");
      auditLog(userId, "user_exists_check", { email: sanitizedEmail, error: sanitized.message }, false);
      throw sanitized;
   }
}

/**
 * Invite a guest user to the tenant via Microsoft Graph API
 * Returns the invited user's ID or existing user's ID
 * Security: Rate limited, input validated, audit logged
 */
export async function inviteGuestUser(email: string, userId: string): Promise<string> {
   // Rate limiting - prevent abuse
   if (!checkRateLimit(userId, "invite")) {
      auditLog(userId, "invite_guest_user", { email }, false);
      throw new Error("Rate limit exceeded. You have reached the maximum number of invitations per hour.");
   }

   // Sanitize and validate email
   const sanitizedEmail = sanitizeEmail(email);

   // Check domain whitelist if configured
   const allowedDomains = getAllowedDomains();
   if (!isDomainAllowed(sanitizedEmail, allowedDomains)) {
      auditLog(userId, "invite_guest_user", { email: sanitizedEmail, reason: "domain_not_allowed" }, false);
      throw new Error("Invitations to this email domain are not allowed.");
   }

   const accessToken = await getGraphAccessToken();

   // First, check if user already exists in the tenant
   const userCheck = await userExistsInTenant(sanitizedEmail, accessToken, userId);
   if (userCheck.exists && userCheck.userId) {
      auditLog(userId, "invite_guest_user", { email: sanitizedEmail, action: "user_already_exists" }, true);
      return userCheck.userId;
   }

   // User doesn't exist, send invitation
   const inviteEndpoint = "https://graph.microsoft.com/v1.0/invitations";
   const redirectUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

   try {
      const response = await fetch(inviteEndpoint, {
         method: "POST",
         headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
         },
         body: JSON.stringify({
            invitedUserEmailAddress: sanitizedEmail,
            inviteRedirectUrl: redirectUrl,
            sendInvitationMessage: true,
         }),
         // Add timeout to prevent hanging requests
         signal: AbortSignal.timeout(30000), // 30 second timeout
      });

      if (!response.ok) {
         const errorText = await response.text();
         const sanitized = sanitizeError(
            new Error(`Graph API returned ${response.status}: ${errorText}`),
            "inviteGuestUser"
         );
         auditLog(userId, "invite_guest_user", { email: sanitizedEmail, error: sanitized.message }, false);
         throw sanitized;
      }

      const data = await response.json();
      const invitedUserId = data.invitedUser?.id || data.invitedUser?.userPrincipalName || sanitizedEmail;

      auditLog(userId, "invite_guest_user", { email: sanitizedEmail, invitedUserId }, true);

      // Return the invited user's ID or email as fallback
      return invitedUserId;
   } catch (error) {
      const sanitized = sanitizeError(error, "inviteGuestUser");
      auditLog(userId, "invite_guest_user", { email: sanitizedEmail, error: sanitized.message }, false);
      throw sanitized;
   }
}

/**
 * Assign a user to the Entra application
 * This is required when "User assignment required" is enabled
 * Security: Input validated, rate limited, audit logged
 */
export async function assignUserToApp(userIdOrEmail: string, adminUserId: string): Promise<void> {
   // Rate limiting
   if (!checkRateLimit(adminUserId, "api_call")) {
      throw new Error("Rate limit exceeded. Please try again later.");
   }

   const accessToken = await getGraphAccessToken();
   const appId = requiredEnv("AUTH_MICROSOFT_ENTRA_ID_CLIENT_ID");

   // Validate at runtime
   if (!appId) {
      throw new Error("Missing AUTH_MICROSOFT_ENTRA_ID_CLIENT_ID environment variable");
   }

   // First, get the user's object ID from Graph
   let userObjectId: string;

   // Check if it looks like an object ID (GUID format)
   if (validateUserId(userIdOrEmail)) {
      // It's already an object ID
      userObjectId = userIdOrEmail;
   } else {
      // Try to get user by email (sanitize first)
      const sanitizedEmail = sanitizeEmail(userIdOrEmail);
      const userCheck = await userExistsInTenant(sanitizedEmail, accessToken, adminUserId);
      if (userCheck.exists && userCheck.userId) {
         userObjectId = userCheck.userId;
      } else {
         const error = new Error("User not found in tenant. The user may need to accept the invitation first.");
         auditLog(adminUserId, "assign_user_to_app", { userIdOrEmail: sanitizedEmail, error: error.message }, false);
         throw error;
      }
   }

   // Get the service principal (app) ID
   // URL encode appId to prevent injection
   const encodedAppId = encodeURIComponent(appId);
   const servicePrincipalEndpoint = `https://graph.microsoft.com/v1.0/servicePrincipals?$filter=appId eq '${encodedAppId}'`;

   try {
      const spResponse = await fetch(servicePrincipalEndpoint, {
         headers: {
            Authorization: `Bearer ${accessToken}`,
         },
         signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (!spResponse.ok) {
         const errorText = await spResponse.text();
         const sanitized = sanitizeError(
            new Error(`Failed to find service principal: ${spResponse.status} ${errorText}`),
            "assignUserToApp"
         );
         auditLog(adminUserId, "assign_user_to_app", { userObjectId, error: sanitized.message }, false);
         throw sanitized;
      }

      const spData = await spResponse.json();
      if (!spData.value || spData.value.length === 0) {
         const error = new Error("Service principal not found for application");
         auditLog(adminUserId, "assign_user_to_app", { userObjectId, error: error.message }, false);
         throw error;
      }

      const servicePrincipalId = spData.value[0].id;

      // Validate service principal ID format
      if (!validateUserId(servicePrincipalId)) {
         const error = new Error("Invalid service principal ID format");
         auditLog(adminUserId, "assign_user_to_app", { userObjectId, error: error.message }, false);
         throw error;
      }

      // Assign the user to the app
      const assignEndpoint = `https://graph.microsoft.com/v1.0/servicePrincipals/${servicePrincipalId}/appRoleAssignedTo`;

      // Use the default "User" app role ID
      // This is the standard ID for the default user role in Azure AD app role assignments
      const appRoleId = "00000000-0000-0000-0000-000000000000";

      // Validate app role ID format
      if (!validateUserId(appRoleId)) {
         const error = new Error("Invalid app role ID format");
         auditLog(adminUserId, "assign_user_to_app", { userObjectId, error: error.message }, false);
         throw error;
      }

      const assignResponse = await fetch(assignEndpoint, {
         method: "POST",
         headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
         },
         body: JSON.stringify({
            principalId: userObjectId,
            resourceId: servicePrincipalId,
            appRoleId: appRoleId,
         }),
         signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (!assignResponse.ok) {
         const errorText = await assignResponse.text();

         // Check if user is already assigned (409 Conflict or 400 with "already exists" message)
         if (assignResponse.status === 409) {
            // User is already assigned, which is fine
            auditLog(adminUserId, "assign_user_to_app", { userObjectId, action: "already_assigned" }, true);
            return;
         }

         // Also check for 400 with "already exists" message (EntitlementGrant entry already exists)
         if (assignResponse.status === 400) {
            try {
               const errorData = JSON.parse(errorText);
               if (
                  errorData.error?.message?.includes("already exists") ||
                  errorData.error?.message?.includes("EntitlementGrant") ||
                  (errorData.error?.code === "Request_BadRequest" &&
                     errorData.error?.message?.toLowerCase().includes("entry"))
               ) {
                  // User is already assigned, which is fine
                  auditLog(adminUserId, "assign_user_to_app", { userObjectId, action: "already_assigned" }, true);
                  return;
               }
            } catch {
               // If we can't parse the error, continue to throw
            }
         }

         // For other errors, throw
         const sanitized = sanitizeError(
            new Error(`Failed to assign user to app: ${assignResponse.status} ${errorText}`),
            "assignUserToApp"
         );
         auditLog(adminUserId, "assign_user_to_app", { userObjectId, error: sanitized.message }, false);
         throw sanitized;
      }

      auditLog(adminUserId, "assign_user_to_app", { userObjectId, success: true }, true);
   } catch (error) {
      const sanitized = sanitizeError(error, "assignUserToApp");
      auditLog(adminUserId, "assign_user_to_app", { userObjectId, error: sanitized.message }, false);
      throw sanitized;
   }
}

/**
 * Invite a guest user to the tenant and assign them to the app
 * If user already exists, we assign them immediately
 * If user is new, assignment happens when they sign in
 * Security: All security measures from inviteGuestUser apply
 */
export async function inviteAndAssignGuestUser(email: string, adminUserId: string): Promise<string> {
   // Rate limiting is checked in inviteGuestUser
   // Invite the user (or get existing user ID)
   const userId = await inviteGuestUser(email, adminUserId);
   const accessToken = await getGraphAccessToken();

   // Check if user already exists in tenant (they've accepted invitation before)
   const userCheck = await userExistsInTenant(email, accessToken, adminUserId);

   if (userCheck.exists && userCheck.userId) {
      // User already exists in tenant, assign them to app immediately
      try {
         await assignUserToApp(userCheck.userId, adminUserId);
      } catch (error) {
         // Log but don't fail - assignment might already exist or user might need to be assigned manually
         const errorMessage = error instanceof Error ? error.message : String(error);
         console.warn("Failed to assign existing user to app during invitation:", errorMessage);
         // Don't throw - assignment will be retried during sign-in
      }
   }
   // If user doesn't exist yet (new invitation), assignment will happen when they sign in

   return userId;
}

/**
 * Assign a user to the app by email (used when user signs in)
 * This is called after the user has accepted the invitation and exists in the tenant
 */
export async function assignUserToAppByEmail(email: string, adminUserId: string): Promise<void> {
   const sanitizedEmail = sanitizeEmail(email);
   await assignUserToApp(sanitizedEmail, adminUserId);
}

/**
 * Auto-assign all users from specified domains to the app
 * This is useful when "User assignment required" is enabled in Entra ID
 * and you want to allow all users from certain domains to sign in automatically
 * 
 * @param domains Array of email domains (e.g., ["contoso.com"])
 * @param adminUserId The ID of the admin user performing this action (for audit logging)
 * @returns Object with count of users assigned and any errors
 */
export async function autoAssignDomainUsers(
   domains: string[],
   adminUserId: string
): Promise<{ assigned: number; errors: Array<{ email: string; error: string }> }> {
   // Rate limiting
   if (!checkRateLimit(adminUserId, "api_call")) {
      throw new Error("Rate limit exceeded. Please try again later.");
   }

   const accessToken = await getGraphAccessToken();
   const errors: Array<{ email: string; error: string }> = [];
   let assigned = 0;

   // Build filter for all specified domains
   // URL encode each domain and create OData filter
   const domainFilters = domains
      .map((domain) => {
         const sanitizedDomain = domain.toLowerCase().trim().replace(/^@/, "");
         const encodedDomain = encodeURIComponent(`@${sanitizedDomain}`);
         return `endsWith(mail,'${encodedDomain}') or endsWith(userPrincipalName,'${encodedDomain}')`;
      })
      .join(" or ");

   const usersEndpoint = `https://graph.microsoft.com/v1.0/users?$filter=${encodeURIComponent(domainFilters)}&$select=id,mail,userPrincipalName`;

   try {
      let nextLink: string | null = usersEndpoint;

      while (nextLink) {
         const response: Response = await fetch(nextLink, {
            headers: {
               Authorization: `Bearer ${accessToken}`,
            },
            signal: AbortSignal.timeout(30000), // 30 second timeout
         });

         if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to fetch users: ${response.status} ${errorText}`);
         }

         const data = await response.json();
         const users = data.value || [];

         // Assign each user to the app
         for (const user of users) {
            try {
               await assignUserToApp(user.id, adminUserId);
               assigned++;
               auditLog(
                  adminUserId,
                  "auto_assign_domain_user",
                  { userId: user.id, email: user.mail || user.userPrincipalName },
                  true
               );
            } catch (error) {
               const errorMessage = error instanceof Error ? error.message : String(error);
               const email = user.mail || user.userPrincipalName || "unknown";
               errors.push({ email, error: errorMessage });
               auditLog(
                  adminUserId,
                  "auto_assign_domain_user",
                  { userId: user.id, email, error: errorMessage },
                  false
               );
            }

            // Rate limit: add small delay between assignments
            if (users.length > 10) {
               await new Promise((resolve) => setTimeout(resolve, 100));
            }
         }

         // Check if there are more pages
         nextLink = data["@odata.nextLink"] || null;
      }

      return { assigned, errors };
   } catch (error) {
      const sanitized = sanitizeError(error, "autoAssignDomainUsers");
      auditLog(adminUserId, "auto_assign_domain_users", { domains, error: sanitized.message }, false);
      throw sanitized;
   }
}
