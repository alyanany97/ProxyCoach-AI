"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ROLES } from "@/constants/roles";
import { inviteGuestUser } from "@/lib/microsoft-graph";
import crypto from "crypto";

function isPT(role?: string | null) {
  return role === ROLES.PT || role === ROLES.ADMIN;
}

// ─── Read ────────────────────────────────────────────────────────────────────

/**
 * Get the PT's own company and basic stats for the dashboard.
 */
export async function getPTDashboard() {
  const session = await auth();
  if (!session?.user?.id || !isPT(session.user.role)) {
    return { success: false as const, error: "Unauthorized" };
  }

  const pt = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      companyId: true,
      company: {
        select: {
          id: true,
          name: true,
          billingEmail: true,
          createdAt: true,
          _count: { select: { users: true, uploadedFiles: true } },
        },
      },
    },
  });

  if (!pt) return { success: false as const, error: "User not found" };

  return { success: true as const, pt };
}

/**
 * Get all clients (users) assigned to the PT's company (excluding the PT themselves).
 */
export async function getPTClients() {
  const session = await auth();
  if (!session?.user?.id || !isPT(session.user.role)) {
    return { success: false as const, error: "Unauthorized" };
  }

  const pt = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { companyId: true },
  });

  if (!pt?.companyId) {
    return { success: false as const, error: "No trainer profile assigned. Ask an admin to create one for you." };
  }

  const clients = await prisma.user.findMany({
    where: { companyId: pt.companyId, id: { not: session.user.id } },
    select: { id: true, name: true, email: true, image: true, role: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return { success: true as const, clients, companyId: pt.companyId };
}

/**
 * Get all invitations created by this PT.
 */
export async function getPTInvitations() {
  const session = await auth();
  if (!session?.user?.id || !isPT(session.user.role)) {
    return { success: false as const, error: "Unauthorized" };
  }

  const invitations = await prisma.invitation.findMany({
    where: { invitedBy: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  // For accepted invitations, look up the user so PT can assign them
  const acceptedEmails = invitations
    .filter((i) => i.status === "accepted")
    .map((i) => i.email.toLowerCase());

  const acceptedUsers =
    acceptedEmails.length > 0
      ? await prisma.user.findMany({
          where: { email: { in: acceptedEmails } },
          select: { id: true, name: true, email: true, companyId: true },
        })
      : [];

  return { success: true as const, invitations, acceptedUsers };
}

// ─── Mutations ───────────────────────────────────────────────────────────────

/**
 * Invite a new client. Creates an invitation and calls Microsoft Graph to
 * send an Entra ID invitation email.
 */
export async function createPTClientInvitation(email: string) {
  const session = await auth();
  if (!session?.user?.id || !isPT(session.user.role)) {
    return { success: false as const, error: "Unauthorized" };
  }

  const trimmed = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { success: false as const, error: "Invalid email address" };
  }

  // Check for existing pending invitation
  const existing = await prisma.invitation.findFirst({
    where: { email: trimmed, status: "pending", expiresAt: { gt: new Date() } },
  });
  if (existing) {
    return { success: false as const, error: "A pending invitation already exists for this email" };
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  try {
    await inviteGuestUser(trimmed, session.user.id);
  } catch (err) {
    console.warn("[PT] Microsoft Graph invitation failed (continuing):", err);
  }

  await prisma.invitation.create({
    data: {
      email: trimmed,
      invitedBy: session.user.id,
      token,
      expiresAt,
      status: "pending",
    },
  });

  return { success: true as const };
}

/**
 * Assign an accepted client (who has signed in but has no company) to the
 * PT's own company.
 */
export async function assignClientToMyCompany(userId: string) {
  const session = await auth();
  if (!session?.user?.id || !isPT(session.user.role)) {
    return { success: false as const, error: "Unauthorized" };
  }

  const pt = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { companyId: true },
  });

  if (!pt?.companyId) {
    return { success: false as const, error: "You don't have a trainer profile assigned yet" };
  }

  const client = await prisma.user.findUnique({
    where: { id: userId },
    select: { companyId: true, email: true },
  });

  if (!client) return { success: false as const, error: "Client not found" };
  if (client.companyId) {
    return { success: false as const, error: "Client is already assigned to a team" };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { companyId: pt.companyId },
  });

  return { success: true as const };
}

/**
 * Remove a client from the PT's company (unassign — does not delete the user).
 */
export async function removeClientFromMyCompany(userId: string) {
  const session = await auth();
  if (!session?.user?.id || !isPT(session.user.role)) {
    return { success: false as const, error: "Unauthorized" };
  }

  const pt = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { companyId: true },
  });

  if (!pt?.companyId) {
    return { success: false as const, error: "No trainer profile found" };
  }

  const client = await prisma.user.findUnique({
    where: { id: userId },
    select: { companyId: true },
  });

  if (client?.companyId !== pt.companyId) {
    return { success: false as const, error: "Client is not in your team" };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { companyId: null },
  });

  return { success: true as const };
}

/**
 * Update the PT's own company/profile information.
 */
export async function updatePTProfile(data: { name?: string; billingEmail?: string }) {
  const session = await auth();
  if (!session?.user?.id || !isPT(session.user.role)) {
    return { success: false as const, error: "Unauthorized" };
  }

  const pt = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { companyId: true },
  });

  if (!pt?.companyId) {
    return { success: false as const, error: "No trainer profile found" };
  }

  const updated = await prisma.company.update({
    where: { id: pt.companyId },
    data: {
      ...(data.name ? { name: data.name } : {}),
      ...(data.billingEmail !== undefined ? { billingEmail: data.billingEmail || null } : {}),
    },
  });

  return { success: true as const, company: updated };
}
