import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ROLES } from "@/constants/roles";
import { deleteAgentFileFromBlob } from "@/lib/blob-storage";
import { deleteDocumentsFromIndex } from "@/lib/azure-search";

/**
 * DELETE /api/files/[fileId]
 * Delete a file (blob first, then database record)
 * 
 * Requires admin authentication
 * Deletion order: 1. Delete blob, 2. Delete database record
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
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

    // Only admins can delete files
    if (session.user.role !== ROLES.ADMIN) {
      return new Response(
        JSON.stringify({ error: "Forbidden: Only admins can delete files" }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const { fileId } = await params;

    // Fetch file record from database
    const file = await prisma.uploadedFile.findUnique({
      where: { id: fileId },
      include: {
        company: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!file) {
      return new Response(
        JSON.stringify({ error: "File not found" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Extract blob path from blob URL
    // Blob URL format: https://...blob.core.windows.net/app/agents/... or .../agents/...
    let blobPath: string | undefined = undefined;
    let fullPath: string | undefined = undefined;
    
    if (file.blobUrl.includes("/agents/")) {
      // Extract path after /agents/ and remove query string
      const urlParts = file.blobUrl.split("/agents/");
      if (urlParts.length > 1) {
        const pathAfterAgents = urlParts[1].split("?")[0];
        blobPath = `agents/${pathAfterAgents}`;
        fullPath = `app/agents/${pathAfterAgents}`;
        console.log(`[Delete] Extracted blob path: ${blobPath}`);
      }
    } else {
      console.warn(`[Delete] Blob URL does not contain '/agents/': ${file.blobUrl}`);
    }

    // Step 1: Delete documents from search index
    try {
      const deletedCount = await deleteDocumentsFromIndex(
        file.companyId || null,
        fileId,
        fullPath
      );
      console.log(`[Delete] Deleted ${deletedCount} document(s) from search index`);
    } catch (error) {
      console.error("Error deleting from search index:", error);
      // Continue with blob/database deletion even if search index deletion fails
      // (documents might not be indexed or index might be unavailable)
    }

    // Step 2: Delete blob from storage
    try {
      if (!blobPath) {
        throw new Error("Could not extract blob path from blobUrl");
      }
      
      console.log(`[Delete] Attempting to delete blob: ${blobPath}`);
      await deleteAgentFileFromBlob(blobPath);
      console.log(`[Delete] Successfully deleted blob from storage`);
    } catch (error) {
      console.error("[Delete] Error deleting blob:", error);
      console.error("[Delete] Error details:", error instanceof Error ? error.stack : String(error));
      // Continue with database deletion even if blob deletion fails
      // (blob might already be deleted or not exist)
    }

    // Step 3: Delete database record
    await prisma.uploadedFile.delete({
      where: { id: fileId },
    });

    return Response.json({ success: true, message: "File deleted successfully" });
  } catch (error) {
    console.error("Error deleting file:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Failed to delete file",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

