import { NextRequest } from "next/server";
import { uploadFileToBlob } from "@/lib/blob-storage";
import { extractTextFromFile, isTextExtractableFile } from "@/lib/file-extraction";

/**
 * POST /api/files/upload
 * Upload a file to Azure Blob Storage
 * 
 * Expected form data:
 * - file: The file to upload
 * - conversationId: The conversation ID to organize files under
 * 
 * Returns:
 * - blobUrl: The URL of the uploaded file in Azure Blob Storage
 * - fileName: The original file name
 * - fileType: The MIME type
 * - fileSize: The file size in bytes
 */
export async function POST(req: NextRequest) {
  try {
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

    // Parse form data
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const conversationId = formData.get("conversationId") as string;

    if (!file) {
      return new Response(
        JSON.stringify({ error: "File is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (!conversationId) {
      return new Response(
        JSON.stringify({ error: "Conversation ID is required" }),
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

    // Allow images and document files (PDF, Excel, Word, CSV)
    const isImage = file.type.startsWith("image/");
    const isDocument = isTextExtractableFile(file.type, file.name);
    
    console.log(`[Upload] File details: name=${file.name}, type=${file.type}, size=${file.size}, isDocument=${isDocument}, isImage=${isImage}`);
    
    if (!isImage && !isDocument) {
      return new Response(
        JSON.stringify({ 
          error: "Unsupported file type. Please upload images, PDFs, Excel files, Word documents, or CSV files." 
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract text from document files (not images)
    let extractedText: string | undefined;
    if (isDocument) {
      try {
        console.log(`[Upload] Attempting to extract text from ${file.type} file: ${file.name}`);
        extractedText = await extractTextFromFile(buffer, file.type, file.name);
        
        if (extractedText) {
          console.log(`[Upload] Successfully extracted ${extractedText.length} characters from ${file.name}`);
          console.log(`[Upload] First 200 chars: ${extractedText.substring(0, 200)}...`);
          
          // Limit extracted text to 50,000 characters to avoid token limits
          if (extractedText.length > 50000) {
            extractedText = extractedText.substring(0, 50000) + "\n\n[Content truncated due to length...]";
          }
        } else {
          console.warn(`[Upload] Extraction returned empty/undefined text for ${file.name}`);
        }
      } catch (error) {
        console.error(`[Upload] Error extracting text from ${file.name}:`, error);
        console.error(`[Upload] Error details:`, error instanceof Error ? error.stack : String(error));
        // Continue with upload even if text extraction fails
        // The file will still be uploaded, just without extracted text
        extractedText = undefined;
      }
    } else {
      console.log(`[Upload] Skipping text extraction for ${file.type} file: ${file.name} (not a document)`);
    }
    
    console.log(`[Upload] Final extractedText status: ${extractedText ? `present (${extractedText.length} chars)` : 'undefined/null'}`);

    // Upload to blob storage
    const blobUrl = await uploadFileToBlob(
      conversationId,
      buffer,
      file.name,
      file.type
    );

    const responseData = {
      blobUrl,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      extractedText, // Include extracted text for document files
    };
    
    console.log(`[Upload] Sending response for ${file.name}:`, {
      hasExtractedText: !!responseData.extractedText,
      extractedTextLength: responseData.extractedText?.length || 0,
    });
    
    return Response.json(responseData);
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

