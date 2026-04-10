"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ROLES } from "@/constants/roles";
import { revalidatePath } from "next/cache";
import type { CompanyFormData, CompanyUpdateData } from "@/types/company";

export async function getAllCompanies() {
    const session = await auth();

    //Must be signed in the first place
    if (!session?.user){
        throw new Error("Unauthorized: You must be signed in");
    }

    //Only admins can view companies
    if(session.user.role !== ROLES.ADMIN){
        throw new Error("Forbidden: Only admins can view companies");
    }

    try{
        const companies = await prisma.company.findMany({ //get all the rows from the company table
            include: {// also fetch the users who belong to each company
                users: {
                    select: { //only fetch the id, name, and email of the users
                        id : true,
                        name : true,
                        email: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },//order by the newest companies first 
        });

        return { success: true, companies };
    } catch (error) {
        console.error("Error fetching companies:", error);
        throw new Error("Failed to fetch companies");
    }
}

export async function createCompany(data: CompanyFormData) {
    const session = await auth();

    if (!session?.user) {
        throw new Error("Unauthorized: You must be signed in");
    }

    if (session.user.role !== ROLES.ADMIN) {
        throw new Error("Forbidden: Only admins can create companies");
    }

    try {
        const company = await prisma.company.create({
            data: {
                name: data.name,
                billingEmail: data.billingEmail || null,
            },
        });

        revalidatePath("/admin/companies");
        return { success: true, company };
    } catch (error) {
        console.error("Error creating company:", error);
        if (error instanceof Error && error.message.includes("Unique constraint")) {
            throw new Error("A company with this name already exists");
        }
        throw new Error("Failed to create company");
    }
}

export async function updateCompany(companyId: string, data: CompanyUpdateData) {
    const session = await auth();

    if (!session?.user) {
        throw new Error("Unauthorized: You must be signed in");
    }

    if (session.user.role !== ROLES.ADMIN) {
        throw new Error("Forbidden: Only admins can update companies");
    }

    try {
        const company = await prisma.company.update({
            where: { id: companyId },
            data: {
                ...(data.name && { name: data.name }),
                ...(data.billingEmail !== undefined && { billingEmail: data.billingEmail || null }),
            },
        });

        revalidatePath("/admin/companies");
        return { success: true, company };
    } catch (error) {
        console.error("Error updating company:", error);
        if (error instanceof Error && error.message.includes("Unique constraint")) {
            throw new Error("A company with this name already exists");
        }
        throw new Error("Failed to update company");
    }
}

export async function deleteCompany(companyId: string) {
    const session = await auth();

    if (!session?.user) {
        throw new Error("Unauthorized: You must be signed in");
    }

    if (session.user.role !== ROLES.ADMIN) {
        throw new Error("Forbidden: Only admins can delete companies");
    }

    try {
        // Check if company has users
        const company = await prisma.company.findUnique({
            where: { id: companyId },
            include: { users: true },
        });

        if (!company) {
            throw new Error("Company not found");
        }

        if (company.users.length > 0) {
            throw new Error("Cannot delete company with assigned users. Please remove all users first.");
        }

        await prisma.company.delete({
            where: { id: companyId },
        });

        revalidatePath("/admin/companies");
        return { success: true };
    } catch (error) {
        console.error("Error deleting company:", error);
        if (error instanceof Error) {
            throw error;
        }
        throw new Error("Failed to delete company");
    }
}

export async function assignUserToCompany(userId: string, companyId: string | null) {
    const session = await auth();

    if (!session?.user) {
        throw new Error("Unauthorized: You must be signed in");
    }

    if (session.user.role !== ROLES.ADMIN) {
        throw new Error("Forbidden: Only admins can assign users to companies");
    }

    try {
        // Check if user already belongs to a company
        const currentUser = await prisma.user.findUnique({
            where: { id: userId },
            include: { company: true },
        });

        if (!currentUser) {
            throw new Error("User not found");
        }

        // If assigning to a new company (not null), check if user is already in a company
        if (companyId !== null && currentUser.companyId !== null && currentUser.companyId !== companyId) {
            const currentCompany = await prisma.company.findUnique({
                where: { id: currentUser.companyId },
            });
            throw new Error(
                `User is already assigned to "${currentCompany?.name || "a company"}". Please remove them from their current company first.`
            );
        }

        // Update the user's company assignment
        const user = await prisma.user.update({
            where: { id: userId },
            data: { companyId },
        });

        revalidatePath("/admin/companies");
        revalidatePath("/admin/users");
        return { success: true, user };
    } catch (error) {
        console.error("Error assigning user to company:", error);
        // Re-throw the error if it's already a user-friendly error message
        if (error instanceof Error && (error.message.includes("already assigned") || error.message.includes("not found"))) {
            throw error;
        }
        throw new Error("Failed to assign user to company");
    }
}