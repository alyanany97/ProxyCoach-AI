"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ROLES } from "@/constants/roles";
import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { inviteAndAssignGuestUser, autoAssignDomainUsers } from "@/lib/microsoft-graph";

function isPTOrAdmin(role?: string | null) {
  return role === ROLES.PT || role === ROLES.ADMIN;
}

/**
 * Server action to create an invitation for a guest user.
 * Admins only.
 */
export async function createInvitation(email: string) {
  const session = await auth();

  if (!session?.user) {
    return { success: false as const, error: "Unauthorized: You must be signed in" };
  }

  if (session.user.role !== ROLES.ADMIN) {
    return { success: false as const, error: "Forbidden: Only admins can create invitations" };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { success: false as const, error: "Invalid email format" };
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  });

  if (existingUser) {
    return { success: false as const, error: "A user with this email already exists" };
  }

  const existingInvitation = await prisma.invitation.findFirst({
    where: {
      email: email.toLowerCase().trim(),
      status: "pending",
      expiresAt: { gt: new Date() },
    },
  });

  if (existingInvitation) {
    return {
      success: false as const,
      error: "This person already has a pending invitation. Cancel it first to reinvite.",
    };
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  try {
    await inviteAndAssignGuestUser(email.toLowerCase().trim(), session.user.id);
  } catch (graphError) {
    console.error("Error inviting user via Microsoft Graph:", graphError);
    return {
      success: false as const,
      error: `Failed to send Microsoft invitation: ${graphError instanceof Error ? graphError.message : "Unknown error"}`,
    };
  }

  try {
    const invitation = await prisma.invitation.create({
      data: {
        email: email.toLowerCase().trim(),
        token,
        invitedBy: session.user.id,
        expiresAt,
        status: "pending",
      },
    });

    revalidatePath("/admin/clients");
    return { success: true as const, invitation };
  } catch (error) {
    console.error("Error creating invitation:", error);
    return { success: false as const, error: "Failed to save invitation" };
  }
}

/**
 * Server action to get all invitations.
 * Admins only.
 */
export async function getAllInvitations() {
  const session = await auth();

  if (!session?.user) {
    return { success: false as const, error: "Unauthorized" };
  }

  if (session.user.role !== ROLES.ADMIN) {
    return { success: false as const, error: "Forbidden" };
  }

  try {
    const invitations = await prisma.invitation.findMany({
      orderBy: { createdAt: "desc" },
    });

    const invitationsWithInviter = await Promise.all(
      invitations.map(async (invitation) => {
        const inviter = await prisma.user.findUnique({
          where: { id: invitation.invitedBy },
          select: { id: true, name: true, email: true },
        });
        return { ...invitation, inviter: inviter || null };
      })
    );

    return { success: true as const, invitations: invitationsWithInviter };
  } catch (error) {
    console.error("Error fetching invitations:", error);
    return { success: false as const, error: "Failed to fetch invitations" };
  }
}

/**
 * Cancel a pending invitation.
 * Admins can cancel any invitation.
 * PTs can cancel only invitations they created.
 */
export async function cancelInvitation(invitationId: string) {
  const session = await auth();

  if (!session?.user) {
    return { success: false as const, error: "Unauthorized" };
  }

  if (!isPTOrAdmin(session.user.role)) {
    return { success: false as const, error: "Forbidden" };
  }

  const invitation = await prisma.invitation.findUnique({
    where: { id: invitationId },
  });

  if (!invitation) {
    return { success: false as const, error: "Invitation not found" };
  }

  // PT can only cancel invitations they sent
  if (session.user.role === ROLES.PT && invitation.invitedBy !== session.user.id) {
    return { success: false as const, error: "You can only cancel invitations you sent" };
  }

  try {
    await prisma.invitation.update({
      where: { id: invitationId },
      data: { status: "cancelled" },
    });

    revalidatePath("/admin/clients");
    revalidatePath("/pt/clients");
    return { success: true as const };
  } catch (error) {
    console.error("Error cancelling invitation:", error);
    return { success: false as const, error: "Failed to cancel invitation" };
  }
}

/**
 * Check if an email has a valid pending invitation.
 * Used during sign-in to allow guest users.
 */
export async function checkInvitation(email: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim();

  const invitation = await prisma.invitation.findFirst({
    where: {
      email: normalizedEmail,
      status: "pending",
      expiresAt: { gt: new Date() },
    },
  });

  return !!invitation;
}

/**
 * Mark an invitation as accepted when a user signs in.
 */
export async function acceptInvitation(email: string, _userId: string) {
  const normalizedEmail = email.toLowerCase().trim();

  const invitation = await prisma.invitation.findFirst({
    where: {
      email: normalizedEmail,
      status: "pending",
      expiresAt: { gt: new Date() },
    },
  });

  if (invitation && invitation.status === "pending") {
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: "accepted", acceptedAt: new Date() },
    });
  }
}

/**
 * Auto-assign all users from specified domains to the app.
 * Admins only.
 */
export async function autoAssignUsersFromDomains(domains: string[]) {
  const session = await auth();

  if (!session?.user) {
    return { success: false as const, error: "Unauthorized" };
  }

  if (session.user.role !== ROLES.ADMIN) {
    return { success: false as const, error: "Forbidden" };
  }

  if (!domains || domains.length === 0) {
    return { success: false as const, error: "At least one domain must be specified" };
  }

  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  for (const domain of domains) {
    const cleanDomain = domain.trim().toLowerCase().replace(/^@/, "");
    if (!domainRegex.test(cleanDomain)) {
      return { success: false as const, error: `Invalid domain format: ${domain}` };
    }
  }

  try {
    const result = await autoAssignDomainUsers(
      domains.map((d) => d.trim().toLowerCase().replace(/^@/, "")),
      session.user.id
    );

    revalidatePath("/admin/clients");
    return {
      success: true as const,
      assigned: result.assigned,
      errors: result.errors,
      message: `Successfully assigned ${result.assigned} user(s) from: ${domains.join(", ")}`,
    };
  } catch (error) {
    console.error("Error auto-assigning domain users:", error);
    return { success: false as const, error: "Failed to auto-assign domain users" };
  }
}
