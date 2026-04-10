"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ROLES, isValidRole } from "@/constants/roles";
import { revalidatePath } from "next/cache";

/**
 * Server action to update a user's role
 * Only admins can update roles
 */
export async function updateUserRole(userId: string, newRole: string) {
   const session = await auth();

   if (!session?.user) {
      throw new Error("Unauthorized: You must be signed in");
   }

   if (session.user.role !== ROLES.ADMIN) {
      throw new Error("Forbidden: Only admins can update roles");
   }

   if (!isValidRole(newRole)) {
      throw new Error(`Invalid role: ${newRole}. Must be one of: ${Object.values(ROLES).join(", ")}`);
   }

   if (userId === session.user.id) {
      throw new Error("Cannot change your own role");
   }

   try {
      const user = await prisma.user.update({
         where: { id: userId },
         data: { role: newRole },
         select: { id: true, email: true, name: true, role: true },
      });

      revalidatePath("/admin/users");
      return { success: true, user };
   } catch (error) {
      console.error("Error updating user role:", error);
      throw new Error("Failed to update user role");
   }
}

/**
 * Server action to get all users with their roles
 * Only admins can view all users
 */
export async function getAllUsers() {
   const session = await auth();

   if (!session?.user) {
      throw new Error("Unauthorized: You must be signed in");
   }

   if (session.user.role !== ROLES.ADMIN) {
      throw new Error("Forbidden: Only admins can view all users");
   }

   try {
      const users = await prisma.user.findMany({
         select: {
            id: true,
            name: true,
            email: true,
            image: true,
            role: true,
            emailVerified: true,
            createdAt: true,
            updatedAt: true,
         },
         orderBy: { createdAt: "desc" },
      });

      return { success: true, users };
   } catch (error) {
      console.error("Error fetching users:", error);
      throw new Error("Failed to fetch users");
   }
}
