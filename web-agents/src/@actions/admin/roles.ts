"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ROLES, isValidRole } from "@/constants/roles";
import { revalidatePath } from "next/cache";

/**
 * Server action to update a user's role.
 * Only admins can update roles.
 */
export async function updateUserRole(userId: string, newRole: string) {
  const session = await auth();

  if (!session?.user) {
    return { success: false as const, error: "Unauthorized: You must be signed in" };
  }

  if (session.user.role !== ROLES.ADMIN) {
    return { success: false as const, error: "Forbidden: Only admins can update roles" };
  }

  if (!isValidRole(newRole)) {
    return { success: false as const, error: `Invalid role: ${newRole}` };
  }

  if (userId === session.user.id) {
    return { success: false as const, error: "You cannot change your own role" };
  }

  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { role: newRole },
      select: { id: true, email: true, name: true, role: true },
    });

    revalidatePath("/admin/clients");
    return { success: true as const, user };
  } catch (error) {
    console.error("Error updating user role:", error);
    return { success: false as const, error: "Failed to update user role" };
  }
}

/**
 * Server action to get all users with their roles.
 * Only admins can view all users.
 */
export async function getAllUsers() {
  const session = await auth();

  if (!session?.user) {
    return { success: false as const, error: "Unauthorized" };
  }

  if (session.user.role !== ROLES.ADMIN) {
    return { success: false as const, error: "Forbidden" };
  }

  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        companyId: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return { success: true as const, users };
  } catch (error) {
    console.error("Error fetching users:", error);
    return { success: false as const, error: "Failed to fetch users" };
  }
}
