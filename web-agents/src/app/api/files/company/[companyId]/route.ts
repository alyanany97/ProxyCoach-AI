import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ROLES } from "@/constants/roles";

/**
 * GET /api/files/company/[companyId]
 * Get all files for a company/trainer.
 *
 * Admin: can query any companyId (including "all" and "No_Company_Assigned").
 * PT: can only query their own companyId.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = session.user.role === ROLES.ADMIN;
    const isPT = session.user.role === ROLES.PT;

    if (!isAdmin && !isPT) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { companyId } = await params;

    // PT can only access their own company's files
    if (isPT) {
      const pt = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { companyId: true },
      });
      if (!pt?.companyId || pt.companyId !== companyId) {
        return Response.json({ error: "Forbidden: You can only view your own trainer files" }, { status: 403 });
      }
    }

    const whereClause =
      companyId === "all" || companyId === "null"
        ? {}
        : companyId === "No_Company_Assigned"
        ? { companyId: null }
        : { companyId };

    const files = await prisma.uploadedFile.findMany({
      where: whereClause,
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        company: {
          select: { id: true, name: true },
        },
        client: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { uploadedAt: "desc" },
    });

    const filesWithMetadata = files.map((file) => {
      let fileType = "unknown";
      if (file.blobUrl.includes("/agents/")) {
        const pathParts = file.blobUrl.split("/");
        const agentsIndex = pathParts.findIndex((part) => part === "agents");
        if (agentsIndex !== -1 && pathParts.length > agentsIndex + 3) {
          fileType = pathParts[agentsIndex + 2];
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
        company: file.company ? { id: file.company.id, name: file.company.name } : null,
        clientId: (file as any).clientId ?? null,
        client: (file as any).client
          ? {
              id: (file as any).client.id,
              name: (file as any).client.name,
              email: (file as any).client.email,
            }
          : null,
        fileType,
        fileName: (file as any).fileName || `File-${file.id.substring(0, 8)}`,
      };
    });

    return Response.json({ files: filesWithMetadata });
  } catch (error) {
    console.error("Error fetching company files:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to fetch files" },
      { status: 500 }
    );
  }
}
