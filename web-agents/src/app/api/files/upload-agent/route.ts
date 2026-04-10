import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { uploadFileToBlobForCompany, getFileTypeFromMime } from "@/lib/blob-storage";
import { extractTextFromFile, isTextExtractableFile } from "@/lib/file-extraction";
import { randomUUID } from "crypto";
import { ROLES } from "@/constants/roles";

/**
 * POST /api/files/upload-agent
 * Upload a file to Azure Blob Storage for agents
 * 
 * This endpoint:
 * - Requires authentication
 * - Uploads files to: agents/{company_id}/{file_type}/{fileId} or agents/No_Company_Assigned/{file_type}/{fileId}
 * - Creates a database record in UploadedFile table
 * 
 * Expected form data:
 * - file: The file to upload
 * - agentId: The agent ID to associate with the file
 * - companyId: The company ID - use "all-companies" for shared files accessible to all companies. Only admins can override their own company
 * - isShared: (optional) "true" to upload as shared file accessible to all companies (set automatically if companyId is "all-companies")
 * 
 * Returns:
 * - id: The uploaded file record ID
 * - blobUrl: The URL of the uploaded file in Azure Blob Storage
 * - uploadedAt: Timestamp of upload
 * - fileName: The original file name
 * - fileType: The file type folder name
 * - companyId: The company ID
 */
export async function POST(req: NextRequest) {
  try {
    // Get authenticated user
    const session = await auth();
    if (!session?.user?.id) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Fetch user with company information
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, companyId: true },
    });

    if (!user) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Parse form data to get agent selection and company (optional)
    const formData = await req.formData();
    const agentId = formData.get("agentId") as string | null;
    const companyIdParam = formData.get("companyId") as string | null;
    const isSharedParam = formData.get("isShared") as string | null;
    
    // Check if this is a shared file (accessible to all companies)
    const isShared = isSharedParam === "true" || companyIdParam === "all-companies";
    
    // Determine which company to use
    // For shared files, companyId should be null
    // Admins can override with companyIdParam, otherwise use user's company
    let targetCompanyId: string | null = isShared ? null : user.companyId;
    if (!isShared && session.user.role === ROLES.ADMIN && companyIdParam) {
      // Admin can specify a company (including "No_Company_Assigned")
      targetCompanyId = companyIdParam === "No_Company_Assigned" ? null : companyIdParam;
    }
    
    // Validate that companyId exists if it's not null
    if (targetCompanyId && !isShared) {
      const companyExists = await prisma.company.findUnique({
        where: { id: targetCompanyId },
        select: { id: true },
      });
      
      if (!companyExists) {
        return new Response(
          JSON.stringify({
            error: `Invalid company ID: ${targetCompanyId}. Company does not exist.`,
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // Validate environment variables
    const hasConnectionString = !!process.env.AZURE_STORAGE_CONNECTION_STRING;
    const hasAccountName = !!process.env.AZURE_STORAGE_ACCOUNT_NAME;
    const hasAccountKey = !!process.env.AZURE_STORAGE_ACCOUNT_KEY;

    if (!hasConnectionString && (!hasAccountName || !hasAccountKey)) {
      return new Response(
        JSON.stringify({
          error: "Missing Azure Storage configuration. Please configure AZURE_STORAGE_CONNECTION_STRING or both AZURE_STORAGE_ACCOUNT_NAME and AZURE_STORAGE_ACCOUNT_KEY",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const file = formData.get("file") as File;

    if (!file) {
      return new Response(
        JSON.stringify({ error: "File is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Validate file size (10MB limit)
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_FILE_SIZE) {
      return new Response(
        JSON.stringify({ error: `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB` }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Determine file type from MIME type
    const fileType = getFileTypeFromMime(file.type, file.name);

    // Generate unique file ID
    const fileId = randomUUID();

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract text from document files (not images)
    let extractedText: string | undefined;
    const isImage = file.type.startsWith("image/");
    const isDocument = isTextExtractableFile(file.type, file.name);
    
    if (isDocument) {
      try {
        console.log(`[Upload-Agent] Attempting to extract text from ${file.type} file: ${file.name}`);
        extractedText = await extractTextFromFile(buffer, file.type, file.name);
        
        if (extractedText) {
          console.log(`[Upload-Agent] Successfully extracted ${extractedText.length} characters from ${file.name}`);
          
          // Limit extracted text to 50,000 characters to avoid token limits
          if (extractedText.length > 50000) {
            extractedText = extractedText.substring(0, 50000) + "\n\n[Content truncated due to length...]";
          }
        } else {
          console.warn(`[Upload-Agent] Extraction returned empty/undefined text for ${file.name}`);
        }
      } catch (error) {
        console.error(`[Upload-Agent] Error extracting text from ${file.name}:`, error);
        // Continue with upload even if text extraction fails
        extractedText = undefined;
      }
    } else {
      console.log(`[Upload-Agent] Skipping text extraction for ${file.type} file: ${file.name} (not a document)`);
    }

    // Upload to blob storage
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
      return new Response(
        JSON.stringify({
          error: "Failed to upload file to storage",
          details: error instanceof Error ? error.message : "Unknown error",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Create database record
    let uploadedFile;
    try {
      uploadedFile = await prisma.uploadedFile.create({
        data: {
          id: fileId,
          uploadedBy: user.id,
          blobUrl: blobUrl,
          fileName: file.name, // Store the actual file name
          // For shared files, set companyId to null
          // For regular files, use targetCompanyId or null
          companyId: isShared ? null : (targetCompanyId || null),
        } as any, // Type assertion needed until Prisma client is regenerated
      });
    } catch (error) {
      console.error("Error creating database record:", error);
      // Note: In production, you might want to delete the blob if DB creation fails
      // For now, we'll just return an error
      return new Response(
        JSON.stringify({
          error: "File uploaded but failed to create database record",
          details: error instanceof Error ? error.message : "Unknown error",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return Response.json({
      id: uploadedFile.id,
      blobUrl: uploadedFile.blobUrl,
      uploadedAt: uploadedFile.uploadedAt,
      fileName: file.name,
      fileType: file.type, // Return MIME type (not folder name) to match FileAttachment interface
      fileSize: file.size,
      companyId: uploadedFile.companyId,
      extractedText, // Include extracted text for document files
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Failed to upload file",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
