import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ROLES } from "@/constants/roles";
import { getAgentsContainerClient } from "@/lib/blob-storage";

/**
 * GET /api/files/company/[companyId]
 * Get all files uploaded by a specific company
 * 
 * Requires admin authentication
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Only admins can view company files
    if (session.user.role !== ROLES.ADMIN) {
      return new Response(
        JSON.stringify({ error: "Forbidden: Only admins can view company files" }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const { companyId } = await params;

    // Handle "all" or null company ID (for viewing all files)
    const whereClause = companyId === "all" || companyId === "null"
      ? {}
      : companyId === "No_Company_Assigned"
      ? { companyId: null }
      : { companyId };

    const files = await prisma.uploadedFile.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        company: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        uploadedAt: "desc",
      },
    });

    // Extract file type from URL path (fileName is now stored in database)
    const filesWithMetadata = files.map((file) => {
      // Extract file type from blob path: agents/{company_id}/{file_type}/{fileId}
      let fileType = "unknown";
      if (file.blobUrl.includes("/agents/")) {
        const pathParts = file.blobUrl.split("/");
        const agentsIndex = pathParts.findIndex(part => part === "agents");
        if (agentsIndex !== -1 && pathParts.length > agentsIndex + 3) {
          fileType = pathParts[agentsIndex + 2]; // file_type is after company_id
        }
      }

      return {
        id: file.id,
        uploadedAt: file.uploadedAt.toISOString(),
        uploadedBy: {
          id: file.user.id,
          name: file.user.name,
          email: file.user.email,
        },
        blobUrl: file.blobUrl,
        companyId: file.companyId,
        company: file.company ? {
          id: file.company.id,
          name: file.company.name,
        } : null,
        fileType,
        fileName: (file as any).fileName || `File-${file.id.substring(0, 8)}`, // Use stored fileName or fallback for old records
      };
    });

    return Response.json({ files: filesWithMetadata });
  } catch (error) {
    console.error("Error fetching company files:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Failed to fetch files",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
