import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ROLES } from "@/constants/roles";

/**
 * GET /api/files/[fileId]/download
 * Proxy download endpoint that streams the file from blob storage
 * 
 * Fetches the file from Azure Blob Storage and streams it to the client
 * with proper Content-Disposition headers to force download.
 * The client never sees the blob URL - only this proxy endpoint.
 * 
 * Requires admin authentication
 */
export async function GET(
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

    // Only admins can download files
    if (session.user.role !== ROLES.ADMIN) {
      return new Response(
        JSON.stringify({ error: "Forbidden: Only admins can download files" }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const { fileId } = await params;

    const file = await prisma.uploadedFile.findUnique({
      where: { id: fileId },
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

    const fileName = (file as any).fileName || `File-${file.id.substring(0, 8)}`;

    // Fetch the file from blob storage using the blob URL
    const blobResponse = await fetch(file.blobUrl);

    if (!blobResponse.ok) {
      throw new Error(`Failed to fetch file from blob storage: ${blobResponse.statusText}`);
    }

    // Get the file content as a stream
    const fileStream = blobResponse.body;
    const contentType = blobResponse.headers.get("content-type") || "application/octet-stream";

    if (!fileStream) {
      throw new Error("File stream is null");
    }

    // Return the file stream with proper headers to force download
    return new Response(fileStream, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
        "Cache-Control": "private, no-cache",
      },
    });
  } catch (error) {
    console.error("Error downloading file:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Failed to download file",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
