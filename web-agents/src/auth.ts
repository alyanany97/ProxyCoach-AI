import NextAuth from "next-auth";
import MicrosoftEntraId from "next-auth/providers/azure-ad";
import { PrismaAdapter } from "@auth/prisma-adapter";

import { prisma } from "@/lib/prisma";
import { ROLES } from "@/constants/roles";
import { checkInvitation, acceptInvitation } from "@/@actions/admin/invitations";
import { assignUserToAppByEmail } from "@/lib/microsoft-graph";

function requiredEnv(name: string): string {
   const value = process.env[name];
   // During Next.js build phase, env vars might not be available
   // Allow empty string during build - NextAuth will validate at runtime
   if (!value && process.env.NEXT_PHASE !== "phase-production-build") {
      throw new Error(`Missing required env var: ${name}`);
   }
   // Return empty string during build - NextAuth provider will handle validation
   return value || "";
}

/**
 * Check if an email is from an allowed domain that can auto-register
 * Users from these domains can sign in without needing an invitation
 * 
 * IMPORTANT: When "User assignment required" is enabled in Entra ID, users must be
 * assigned to the app BEFORE they can authenticate. Entra ID checks assignment
 * before allowing the OAuth callback to complete, so we can't assign users during
 * the authentication flow.
 * 
 * Solutions:
 * 1. Disable "User assignment required" in Entra ID and handle authorization
 *    in NextAuth callbacks (recommended for auto-registration)
 * 2. Pre-assign all users from these domains using the autoAssignUsersFromDomains
 *    server action (see @actions/admin/invitations.ts)
 * 3. Use scheduled job or webhook to assign users when they're added to Entra ID
 *
 * Configure comma-separated email domains via ALLOWED_AUTO_REGISTER_DOMAINS (e.g. "ymca.ca,partner.org").
 * If unset or empty, no domain matches auto-register (invitation flow still applies).
 */
function getAutoRegisterDomains(): string[] {
   const raw = process.env.ALLOWED_AUTO_REGISTER_DOMAINS?.trim();
   if (!raw) return [];
   return raw
      .split(",")
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);
}

function isAutoRegisterDomain(email: string): boolean {
   const normalizedEmail = email.toLowerCase().trim();
   const allowedDomains = getAutoRegisterDomains();
   return allowedDomains.some((domain) => normalizedEmail.endsWith(`@${domain}`));
}

export const {
   handlers: { GET, POST },
   auth,
   signIn,
   signOut,
} = NextAuth({
   adapter: PrismaAdapter(prisma),
   session: {
      strategy: "database",
   },
   // Security: If AUTH_URL is explicitly set, use it (more secure - prevents host header injection)
   // If AUTH_URL is not set, fall back to trustHost: true (required for Azure App Service behind proxy)
   // RECOMMENDED: Set AUTH_URL environment variable in Azure App Service configuration
   // Example for develop: AUTH_URL=https://dev-portal.your-domain.com
   // Example for prod: AUTH_URL=https://portal.your-domain.com
   trustHost: true,
   providers: [
      MicrosoftEntraId({
         clientId: requiredEnv("AUTH_MICROSOFT_ENTRA_ID_CLIENT_ID"),
         clientSecret: requiredEnv("AUTH_MICROSOFT_ENTRA_ID_CLIENT_SECRET"),
         // Use ProxyCoach's specific tenant so B2B guest users authenticate through
         // this tenant (where their guest account lives after accepting the invitation).
         // Using "organizations" incorrectly routes them to their home tenant instead.
         issuer: `https://login.microsoftonline.com/${requiredEnv("AUTH_MICROSOFT_ENTRA_ID_TENANT_ID")}/v2.0`,
         authorization: {
            url: `https://login.microsoftonline.com/${process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID}/oauth2/v2.0/authorize`,
            params: { scope: "openid profile email User.Read" },
         },
         token: `https://login.microsoftonline.com/${process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID}/oauth2/v2.0/token`,
         userinfo: "https://graph.microsoft.com/oidc/userinfo",
      }),
   ],
   pages: {
      signIn: "/auth/signin",
      error: "/auth/error",
   },
   callbacks: {
      async signIn({ user, account, profile }) {
         // Log for debugging
         console.log("[signIn callback] User:", { email: user.email, name: user.name });
         console.log("[signIn callback] Profile:", profile);

         // Extract email from user object or profile
         // Azure AD may not provide email if user doesn't have email license,
         // in which case we fall back to preferred_username which contains the email
         const email =
            user.email ||
            (profile as any)?.email ||
            (profile as any)?.mail ||
            (profile as any)?.userPrincipalName ||
            (profile as any)?.preferred_username;

         if (!email) {
            console.warn("[signIn callback] No email found in user or profile");
            return false;
         }

         // Ensure user.email is set (NextAuth might not always populate it)
         if (!user.email && email) {
            user.email = email;
         }

         // Always allow the designated super-admin
         const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase().trim();
         if (adminEmail && email.toLowerCase().trim() === adminEmail) {
            console.log("[signIn callback] Super-admin sign-in allowed:", email);
            return true;
         }

         // Auto-register users from allowed domains (no invitation required)
         if (isAutoRegisterDomain(email)) {
            console.log("[signIn callback] User is from auto-register domain:", email);
            
            // If user already exists, allow sign in
            const existingUser = await prisma.user.findUnique({
               where: { email: email.toLowerCase().trim() },
            });

            if (existingUser) {
               console.log("[signIn callback] Existing user found, ensuring app assignment");
               // Ensure user is assigned to app (in case assignment failed previously)
               try {
                  await assignUserToAppByEmail(email, existingUser.id);
               } catch (error) {
                  // Log but don't block sign-in - assignment might already exist
                  console.warn("Failed to assign existing user from an allowed domain to app:", error);
               }
            } else {
               console.log("[signIn callback] New user from auto-register domain, will be created");
            }

            // Allow sign in - user will be created by PrismaAdapter if new
            // Assignment will happen in session callback for new users
            return true;
         }

         // If user already exists, allow sign in and mark invitation as accepted if applicable
         const existingUser = await prisma.user.findUnique({
            where: { email: email.toLowerCase().trim() },
         });

         if (existingUser) {
            // Check if user has a pending invitation before accepting it
            // This handles the case where assignment failed during invitation
            const hasInvitation = await checkInvitation(email);
            if (hasInvitation) {
               // Mark invitation as accepted
               await acceptInvitation(email, existingUser.id);

               // Try to assign user to app (they should exist in tenant now)
               try {
                  // Use the user's own ID as the admin ID for audit purposes
                  // In production, you might want to track the original inviter
                  await assignUserToAppByEmail(email, existingUser.id);
               } catch (error) {
                  // Log but don't block sign-in - assignment might already exist
                  console.warn("Failed to assign existing user to app:", error);
               }
            }

            return true;
         }

         // Check if user has a valid invitation (for guest users from external domains)
         const hasInvitation = await checkInvitation(email);
         if (hasInvitation) {
            // User will be created by PrismaAdapter, then we'll assign them to the app
            // and mark invitation as accepted in the session callback
            return true;
         }

         // No invitation found — deny access
         console.warn("[signIn callback] Access denied — no invitation for:", email);
         return false;
      },
      async session({ session, user }) {
         if (session.user) {
            session.user.id = user.id;
            session.user.role = user.role ?? "user";

            // Always ensure the super-admin has admin role
            const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase().trim();
            if (adminEmail && user.email?.toLowerCase().trim() === adminEmail && user.role !== ROLES.ADMIN) {
               await prisma.user.update({ where: { id: user.id }, data: { role: ROLES.ADMIN } });
               session.user.role = ROLES.ADMIN;
            }

            // Auto-assign PT role for ytr.ymca.ca emails if not already elevated
            if (
               user.email?.toLowerCase().endsWith("@ytr.ymca.ca") &&
               user.role !== ROLES.PT &&
               user.role !== ROLES.ADMIN
            ) {
               await prisma.user.update({ where: { id: user.id }, data: { role: ROLES.PT } });
               session.user.role = ROLES.PT;
            }

            // For new users (just created), assign them to the app
            if (user.email) {
               // Auto-register users from allowed domains
               if (isAutoRegisterDomain(user.email)) {
                  // Automatically assign user to the app (no invitation needed)
                  try {
                     // Use the user's own ID as the admin ID for audit purposes
                     await assignUserToAppByEmail(user.email, user.id);
                  } catch (error) {
                     // Log but don't block session creation
                     // Assignment might fail if user hasn't fully synced in tenant yet
                     // or if they're already assigned
                     console.warn("Failed to assign new user from an allowed domain to app during sign-in:", error);
                     // Don't throw - allow user to sign in, assignment can be retried
                  }

                  // Also accept any pending invitation for this email
                  // (e.g. if a ytr.ymca.ca trainer was explicitly invited)
                  const hasInvitation = await checkInvitation(user.email);
                  if (hasInvitation) {
                     await acceptInvitation(user.email, user.id);
                  }

                  // Auto-create trainer profile for ytr.ymca.ca users if they don't have one
                  if (user.email.toLowerCase().endsWith("@ytr.ymca.ca")) {
                     const dbUser = await prisma.user.findUnique({
                        where: { id: user.id },
                        select: { id: true, name: true, companyId: true },
                     });

                     if (dbUser && !dbUser.companyId) {
                        try {
                           const trainerName = dbUser.name || user.email.split("@")[0];
                           const company = await prisma.company.create({
                              data: { name: trainerName },
                           });
                           await prisma.user.update({
                              where: { id: user.id },
                              data: { companyId: company.id },
                           });
                           console.log(`[session callback] Auto-created trainer profile "${trainerName}" for ${user.email}`);
                        } catch (error) {
                           console.warn("Failed to auto-create trainer profile:", error);
                        }
                     }
                  }
               } else {
                  // For other users, check if they have an invitation
                  const hasInvitation = await checkInvitation(user.email);
                  if (hasInvitation) {
                     // Mark invitation as accepted
                     await acceptInvitation(user.email, user.id);

                     // Assign user to the app (now that they exist in the tenant after accepting invitation)
                     try {
                        // Use the user's own ID as the admin ID for audit purposes
                        // In production, you might want to track the original inviter
                        await assignUserToAppByEmail(user.email, user.id);
                     } catch (error) {
                        // Log but don't block session creation
                        // Assignment might fail if user hasn't fully accepted invitation yet
                        // or if they're already assigned
                        console.warn("Failed to assign new user to app during sign-in:", error);
                        // Don't throw - allow user to sign in, assignment can be retried
                     }
                  }
               }
            }
         }
         return session;
      },
   },
});


