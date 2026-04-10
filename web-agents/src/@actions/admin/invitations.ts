"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ROLES } from "@/constants/roles";
import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { inviteAndAssignGuestUser, autoAssignDomainUsers } from "@/lib/microsoft-graph";

/**
 * Server action to create an invitation for a guest user
 * Only admins can create invitations
 */
export async function createInvitation(email: string) {
   const session = await auth();

   if (!session?.user) {
      throw new Error("Unauthorized: You must be signed in");
   }

   if (session.user.role !== ROLES.ADMIN) {
      throw new Error("Forbidden: Only admins can create invitations");
   }

   // Validate email format
   const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
   if (!emailRegex.test(email)) {
      throw new Error("Invalid email format");
   }

   // Check if user already exists
   const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
   });

   if (existingUser) {
      throw new Error("User with this email already exists");
   }

   // Check if there's already a pending invitation for this email
   const existingInvitation = await prisma.invitation.findFirst({
      where: {
         email: email.toLowerCase().trim(),
         status: "pending",
         expiresAt: {
            gt: new Date(),
         },
      },
   });

   if (existingInvitation) {
      throw new Error("A pending invitation already exists for this email");
   }

   // Generate a secure token
   const token = randomBytes(32).toString("hex");

   // Set expiration to 7 days from now
   const expiresAt = new Date();
   expiresAt.setDate(expiresAt.getDate() + 7);

   try {
      // Invite the user via Microsoft Graph API and assign them to the app
      // This is required when "User assignment required" is enabled on the Entra app
      // Pass admin user ID for rate limiting and audit logging
      let graphUserId: string | undefined;
      try {
         graphUserId = await inviteAndAssignGuestUser(email.toLowerCase().trim(), session.user.id);
      } catch (graphError) {
         console.error("Error inviting user via Microsoft Graph:", graphError);
         // Continue with database invitation even if Graph API call fails
         // The admin can retry or manually assign the user
         throw new Error(
            `Failed to invite user via Microsoft Graph: ${graphError instanceof Error ? graphError.message : "Unknown error"
            }. Please ensure the user is assigned to the app in Azure AD.`
         );
      }

      // Create the invitation in our database
      const invitation = await prisma.invitation.create({
         data: {
            email: email.toLowerCase().trim(),
            token,
            invitedBy: session.user.id,
            expiresAt,
            status: "pending",
         },
      });

      revalidatePath("/admin/users");
      return { success: true, invitation, graphUserId };
   } catch (error) {
      console.error("Error creating invitation:", error);
      if (error instanceof Error) {
         throw error;
      }
      throw new Error("Failed to create invitation");
   }
}

/**
 * Server action to get all invitations
 * Only admins can view invitations
 */
export async function getAllInvitations() {
   const session = await auth();

   if (!session?.user) {
      throw new Error("Unauthorized: You must be signed in");
   }

   if (session.user.role !== ROLES.ADMIN) {
      throw new Error("Forbidden: Only admins can view invitations");
   }

   try {
      const invitations = await prisma.invitation.findMany({
         orderBy: { createdAt: "desc" },
      });

      // Get inviter details for each invitation
      const invitationsWithInviter = await Promise.all(
         invitations.map(async (invitation) => {
            const inviter = await prisma.user.findUnique({
               where: { id: invitation.invitedBy },
               select: {
                  id: true,
                  name: true,
                  email: true,
               },
            });
            return {
               ...invitation,
               inviter: inviter || null,
            };
         })
      );

      return { success: true, invitations: invitationsWithInviter };
   } catch (error) {
      console.error("Error fetching invitations:", error);
      throw new Error("Failed to fetch invitations");
   }
}

/**
 * Server action to cancel an invitation
 * Only admins can cancel invitations
 */
export async function cancelInvitation(invitationId: string) {
   const session = await auth();

   if (!session?.user) {
      throw new Error("Unauthorized: You must be signed in");
   }

   if (session.user.role !== ROLES.ADMIN) {
      throw new Error("Forbidden: Only admins can cancel invitations");
   }

   try {
      await prisma.invitation.update({
         where: { id: invitationId },
         data: { status: "cancelled" },
      });

      revalidatePath("/admin/users");
      return { success: true };
   } catch (error) {
      console.error("Error cancelling invitation:", error);
      throw new Error("Failed to cancel invitation");
   }
}

/**
 * Check if an email has a valid pending invitation
 * Used during sign-in to allow guest users
 */
export async function checkInvitation(email: string): Promise<boolean> {
   const normalizedEmail = email.toLowerCase().trim();

   const invitation = await prisma.invitation.findFirst({
      where: {
         email: normalizedEmail,
         status: "pending",
         expiresAt: {
            gt: new Date(),
         },
      },
   });

   return !!invitation;
}

/**
 * Mark an invitation as accepted when a user signs in
 */
export async function acceptInvitation(email: string, _userId: string) {
   const normalizedEmail = email.toLowerCase().trim();

   const invitation = await prisma.invitation.findFirst({
      where: {
         email: normalizedEmail,
         status: "pending",
         expiresAt: {
            gt: new Date(),
         },
      },
   });

   if (invitation && invitation.status === "pending") {
      await prisma.invitation.update({
         where: { id: invitation.id },
         data: {
            status: "accepted",
            acceptedAt: new Date(),
         },
      });
   }
}

/**
 * Server action to auto-assign all users from specified domains to the app
 * This is useful when "User assignment required" is enabled in Entra ID
 * and you want to allow all users from certain domains (e.g., your-company.com) to sign in automatically
 * Only admins can trigger this action
 * 
 * @param domains Array of email domains (without @) to auto-assign
 * @returns Result with count of users assigned and any errors
 */
export async function autoAssignUsersFromDomains(domains: string[]) {
   const session = await auth();

   if (!session?.user) {
      throw new Error("Unauthorized: You must be signed in");
   }

   if (session.user.role !== ROLES.ADMIN) {
      throw new Error("Forbidden: Only admins can auto-assign domain users");
   }

   if (!domains || domains.length === 0) {
      throw new Error("At least one domain must be specified");
   }

   // Validate domain format (basic validation)
   const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
   for (const domain of domains) {
      const cleanDomain = domain.trim().toLowerCase().replace(/^@/, "");
      if (!domainRegex.test(cleanDomain)) {
         throw new Error(`Invalid domain format: ${domain}`);
      }
   }

   try {
      const result = await autoAssignDomainUsers(
         domains.map((d) => d.trim().toLowerCase().replace(/^@/, "")),
         session.user.id
      );

      revalidatePath("/admin/users");
      return {
         success: true,
         assigned: result.assigned,
         errors: result.errors,
         message: `Successfully assigned ${result.assigned} user(s) from domain(s): ${domains.join(", ")}`,
      };
   } catch (error) {
      console.error("Error auto-assigning domain users:", error);
      if (error instanceof Error) {
         throw error;
      }
      throw new Error("Failed to auto-assign domain users");
   }
}
