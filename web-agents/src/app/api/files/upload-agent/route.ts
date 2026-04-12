import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { uploadFileToBlobForCompany, getFileTypeFromMime } from "@/lib/blob-storage";
import { extractTextFromFile, isTextExtractableFile } from "@/lib/file-extraction";
import { randomUUID } from "crypto";
import { ROLES } from "@/constants/roles";

/**
 * POST /api/files/upload-agent
 * Upload a file to Azure Blob Storage for agents.
 *
 * Admin: can specify any companyId, trainerId, and optional clientId.
 * PT: companyId is always their own trainer profile; can optionally specify clientId
 *     (must belong to their company).
 * Shared: set isShared=true or companyId=all-companies (admin only).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, companyId: true },
    });

    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const isAdmin = session.user.role === ROLES.ADMIN;
    const isPT = session.user.role === ROLES.PT;

    if (!isAdmin && !isPT) {
      return Response.json({ error: "Forbidden: Only admins and PTs can upload files" }, { status: 403 });
    }

    const formData = await req.formData();
    const agentId = formData.get("agentId") as string | null;
    const companyIdParam = formData.get("companyId") as string | null;
    const clientIdParam = formData.get("clientId") as string | null;
    const isSharedParam = formData.get("isShared") as string | null;

    const isShared = isAdmin && (isSharedParam === "true" || companyIdParam === "all-companies");

    // Determine target company
    let targetCompanyId: string | null;
    if (isShared) {
      targetCompanyId = null;
    } else if (isAdmin && companyIdParam && companyIdParam !== "all-companies") {
      targetCompanyId = companyIdParam === "No_Company_Assigned" ? null : companyIdParam;
    } else {
      // PT always uses their own company
      targetCompanyId = user.companyId;
    }

    // Validate company exists
    if (targetCompanyId) {
      const companyExists = await prisma.company.findUnique({
        where: { id: targetCompanyId },
        select: { id: true },
      });
      if (!companyExists) {
        return Response.json({ error: `Trainer profile not found: ${targetCompanyId}` }, { status: 400 });
      }
    }

    // Determine target client
    let targetClientId: string | null = null;
    if (clientIdParam && !isShared) {
      // Validate the client belongs to the target company
      const clientUser = await prisma.user.findUnique({
        where: { id: clientIdParam },
        select: { id: true, companyId: true },
      });
      if (!clientUser) {
        return Response.json({ error: "Client not found" }, { status: 400 });
      }
      if (targetCompanyId && clientUser.companyId !== targetCompanyId) {
        return Response.json({ error: "Client does not belong to the selected trainer" }, { status: 400 });
      }
      targetClientId = clientIdParam;
    }

    // Azure Storage config check
    const hasConnectionString = !!process.env.AZURE_STORAGE_CONNECTION_STRING;
    const hasAccountName = !!process.env.AZURE_STORAGE_ACCOUNT_NAME;
    const hasAccountKey = !!process.env.AZURE_STORAGE_ACCOUNT_KEY;

    if (!hasConnectionString && (!hasAccountName || !hasAccountKey)) {
      return Response.json(
        { error: "Missing Azure Storage configuration. Please configure AZURE_STORAGE_CONNECTION_STRING or both AZURE_STORAGE_ACCOUNT_NAME and AZURE_STORAGE_ACCOUNT_KEY" },
        { status: 500 }
      );
    }

    const file = formData.get("file") as File;
    if (!file) {
      return Response.json({ error: "File is required" }, { status: 400 });
    }

    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      return Response.json({ error: `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB` }, { status: 400 });
    }

    const fileType = getFileTypeFromMime(file.type, file.name);
    const fileId = randomUUID();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Text extraction
    let extractedText: string | undefined;
    if (isTextExtractableFile(file.type, file.name)) {
      try {
        extractedText = await extractTextFromFile(buffer, file.type, file.name);
        if (extractedText && extractedText.length > 50000) {
          extractedText = extractedText.substring(0, 50000) + "\n\n[Content truncated due to length...]";
        }
      } catch (error) {
        console.error(`[Upload-Agent] Error extracting text from ${file.name}:`, error);
      }
    }

    // Upload to blob
    let blobUrl: string;
    try {
      blobUrl = await uploadFileToBlobForCompany(
        targetCompanyId,
        fileType,
        fileId,
        buffer,
        file.name,
        file.type,
        isShared,
        agentId || undefined
      );
    } catch (error) {
      console.error("Error uploading file to blob storage:", error);
      return Response.json(
        { error: "Failed to upload file to storage", details: error instanceof Error ? error.message : "Unknown error" },
        { status: 500 }
      );
    }

    // Create DB record
    let uploadedFile;
    try {
      uploadedFile = await prisma.uploadedFile.create({
        data: {
          id: fileId,
          uploadedBy: user.id,
          blobUrl,
          fileName: file.name,
          companyId: isShared ? null : (targetCompanyId || null),
          clientId: targetClientId,
          extractedText,
        } as any,
      });
    } catch (error) {
      console.error("Error creating database record:", error);
      return Response.json(
        { error: "File uploaded but failed to create database record", details: error instanceof Error ? error.message : "Unknown error" },
        { status: 500 }
      );
    }

    return Response.json({
      id: uploadedFile.id,
      blobUrl: uploadedFile.blobUrl,
      uploadedAt: uploadedFile.uploadedAt,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      companyId: uploadedFile.companyId,
      clientId: targetClientId,
      extractedText,
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to upload file" },
      { status: 500 }
    );
  }
}
