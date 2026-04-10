import { BlobServiceClient, ContainerClient, StorageSharedKeyCredential, BlobSASPermissions } from "@azure/storage-blob";

/**
 * Azure Blob Storage configuration
 * 
 * Required environment variables:
 * - AZURE_STORAGE_ACCOUNT_NAME: Your Azure Storage account name
 * - AZURE_STORAGE_ACCOUNT_KEY: Your Azure Storage account key (or use connection string)
 * - AZURE_STORAGE_CONNECTION_STRING: Alternative to account name/key (if provided, this takes precedence)
 * - AZURE_STORAGE_CONTAINER_NAME: Container name for storing files (defaults to "chat-files")
 */

const CONTAINER_NAME = process.env.AZURE_STORAGE_CONTAINER_NAME || "chat-files";
const AGENTS_CONTAINER_NAME = process.env.AZURE_STORAGE_AGENTS_CONTAINER_NAME || "app";

/**
 * Get the blob service client
 */
function getBlobServiceClient(): BlobServiceClient {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  
  if (connectionString) {
    return BlobServiceClient.fromConnectionString(connectionString);
  }

  const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
  const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;

  if (!accountName || !accountKey) {
    throw new Error(
      "Azure Storage configuration missing. Provide either AZURE_STORAGE_CONNECTION_STRING or both AZURE_STORAGE_ACCOUNT_NAME and AZURE_STORAGE_ACCOUNT_KEY"
    );
  }

  const accountUrl = `https://${accountName}.blob.core.windows.net`;
  const credential = new StorageSharedKeyCredential(accountName, accountKey);
  return new BlobServiceClient(accountUrl, credential);
}

/**
 * Get or create the container client
 */
async function getContainerClient(): Promise<ContainerClient> {
  const blobServiceClient = getBlobServiceClient();
  const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);

  // Create container if it doesn't exist
  const exists = await containerClient.exists();
  if (!exists) {
    await containerClient.create({
      // No public access - we use SAS tokens for secure access
      // This keeps blobs private by default
    });
  }

  return containerClient;
}

/**
 * Get or create the agents container client (for company-based file uploads)
 */
export async function getAgentsContainerClient(): Promise<ContainerClient> {
  const blobServiceClient = getBlobServiceClient();
  const containerClient = blobServiceClient.getContainerClient(AGENTS_CONTAINER_NAME);

  // Create container if it doesn't exist
  const exists = await containerClient.exists();
  if (!exists) {
    await containerClient.create({
      // No public access - we use SAS tokens for secure access
      // This keeps blobs private by default
    });
  }

  return containerClient;
}

/**
 * Map MIME type and file name to a file type folder name
 * Used for organizing files in blob storage: agents/{company_id}/{file_type}/fileID
 * 
 * @param mimeType - The MIME type of the file
 * @param fileName - The original file name (for extension-based detection)
 * @returns The file type folder name (e.g., "pdf", "excel", "img", "csv", "doc", "other")
 */
export function getFileTypeFromMime(mimeType: string, fileName: string): string {
  const lowerMime = mimeType.toLowerCase();
  const lowerFileName = fileName.toLowerCase();

  // PDF files
  if (lowerMime === "application/pdf" || lowerFileName.endsWith(".pdf")) {
    return "pdf";
  }

  // Excel files
  if (
    lowerMime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    lowerMime === "application/vnd.ms-excel" ||
    lowerMime === "application/excel" ||
    lowerFileName.endsWith(".xlsx") ||
    lowerFileName.endsWith(".xls")
  ) {
    return "excel";
  }

  // Word documents
  if (
    lowerMime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lowerMime === "application/msword" ||
    lowerFileName.endsWith(".docx") ||
    lowerFileName.endsWith(".doc")
  ) {
    return "doc";
  }

  // CSV files
  if (lowerMime === "text/csv" || lowerFileName.endsWith(".csv")) {
    return "csv";
  }

  // Images
  if (lowerMime.startsWith("image/")) {
    return "img";
  }

  // Default to "other" for unknown types
  return "other";
}


/**
 * Upload a file to Azure Blob Storage for basic LLM chat
 * Files are organized by conversation ID and file type: app/basic-llm/{conversationId}/{fileType}/{fileId}
 * This path structure allows files to be indexed by Azure Functions if needed
 * 
 * @param conversationId - The conversation ID to organize files under
 * @param file - The file buffer or data
 * @param fileName - The original file name
 * @param contentType - The MIME type of the file
 * @returns The blob URL with SAS token for Azure OpenAI access
 */
export async function uploadFileToBlob(
  conversationId: string,
  file: Buffer | Uint8Array | ArrayBuffer,
  fileName: string,
  contentType: string
): Promise<string> {
  // Use the app container (same as agents) for basic-llm files
  const containerClient = await getAgentsContainerClient();
  
  // Sanitize filename to remove any path separators
  const sanitizedFileName = fileName.replace(/[\/\\]/g, "_");
  
  // Get file type for organizing in blob storage
  const fileType = getFileTypeFromMime(contentType, fileName);
  
  // Generate a unique file ID using timestamp and sanitized filename
  const fileId = `${Date.now()}_${sanitizedFileName}`;
  
  // Create blob path: basic-llm/{conversationId}/{fileType}/{fileId}
  // This matches the structure expected by Azure Functions for indexing
  const blobName = `basic-llm/${conversationId}/${fileType}/${fileId}`;
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  // Upload the file
  const fileLength = file instanceof ArrayBuffer ? file.byteLength : file.length;
  await blockBlobClient.upload(file, fileLength, {
    blobHTTPHeaders: {
      blobContentType: contentType,
    },
    metadata: {
      originalFileName: sanitizedFileName,
    },
  });

  // Generate SAS URL for Azure OpenAI access
  // SAS tokens allow Azure OpenAI to access the blob without making it fully public
  const expiresOn = new Date();
  expiresOn.setFullYear(expiresOn.getFullYear() + 1); // 1 year expiration

  try {
    const sasUrl = await blockBlobClient.generateSasUrl({
      permissions: BlobSASPermissions.parse("r"), // Read only
      expiresOn,
    });
    return sasUrl;
  } catch (error) {
    // Fallback to direct URL if SAS generation fails
    console.warn("Could not generate SAS token, using direct blob URL. Azure OpenAI may not be able to access it.", error);
    return blockBlobClient.url;
  }
}

/**
 * Delete a file from Azure Blob Storage
 * 
 * @param conversationId - The conversation ID
 * @param fileName - The file name
 */
export async function deleteFileFromBlob(
  conversationId: string,
  fileName: string
): Promise<void> {
  const containerClient = await getContainerClient();
  const sanitizedFileName = fileName.replace(/[\/\\]/g, "_");
  const blobName = `${conversationId}/${sanitizedFileName}`;
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  await blockBlobClient.deleteIfExists();
}

/**
 * Delete all files for a conversation
 * 
 * @param conversationId - The conversation ID
 */
export async function deleteConversationFiles(conversationId: string): Promise<void> {
  const containerClient = await getContainerClient();
  const prefix = `${conversationId}/`;

  // List all blobs with the conversation prefix
  for await (const blob of containerClient.listBlobsFlat({ prefix })) {
    const blockBlobClient = containerClient.getBlockBlobClient(blob.name);
    await blockBlobClient.deleteIfExists();
  }
}

/**
 * Upload a file to Azure Blob Storage for agents
 * Files are organized by agent, company, and file type: app/agents/{agent_id}/{company_id}/{file_type}/{fileId}
 * For shared files: app/agents/shared/{agent_id}/{file_type}/{fileId}
 * The "app/" prefix is required for the Azure Function blob trigger to automatically index files to Azure AI Search
 * The agent_id in the path allows the function app to route documents to the correct search index
 * 
 * @param companyId - The company ID to organize files under (null for shared files)
 * @param fileType - The file type folder (e.g., "pdf", "excel", "img", "csv", "doc")
 * @param fileId - The unique file ID
 * @param file - The file buffer or data
 * @param fileName - The original file name
 * @param contentType - The MIME type of the file
 * @param isShared - Whether this is a shared file accessible to all companies
 * @param agentId - The agent ID to route the file to the correct search index
 * @returns The blob URL with SAS token
 */
export async function uploadFileToBlobForCompany(
  companyId: string | null,
  fileType: string,
  fileId: string,
  file: Buffer | Uint8Array | ArrayBuffer,
  fileName: string,
  contentType: string,
  isShared: boolean = false,
  agentId?: string
): Promise<string> {
  const containerClient = await getAgentsContainerClient();
  
  // Sanitize filename to remove any path separators
  const sanitizedFileName = fileName.replace(/[\/\\]/g, "_");
  
  // Agent ID is required to route to the correct search index
  if (!agentId) {
    throw new Error("Agent ID is required for agent file uploads");
  }
  
  // Create blob path based on whether it's shared or company-specific
  let blobName: string;
  if (isShared) {
    // For shared files: agents/{agent_id}/shared/{file_type}/{fileId}
    // "shared" is in the company_id position
    blobName = `agents/${agentId}/shared/${fileType}/${fileId}`;
  } else {
    // For company-specific files: agents/{agent_id}/{company_id}/{file_type}/{fileId}
    // Use "No_Company_Assigned" if companyId is null
    const companyFolder = companyId || "No_Company_Assigned";
    blobName = `agents/${agentId}/${companyFolder}/${fileType}/${fileId}`;
  }
  
  // Note: "app" is the container name, so we don't include it in the blob path
  // The Azure Function blob trigger path "app/agents/..." refers to container "app" and blob path "agents/..."
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  // Log the blob path for debugging
  console.log(`[Upload-Agent] Uploading to container 'app', blob path: ${blobName}`);
  console.log(`[Upload-Agent] Full blob path that Function App should trigger on: app/${blobName}`);

  // Upload the file
  const fileLength = file instanceof ArrayBuffer ? file.byteLength : file.length;
  await blockBlobClient.upload(file, fileLength, {
    blobHTTPHeaders: {
      blobContentType: contentType,
    },
    metadata: {
      originalFileName: sanitizedFileName,
    },
  });
  
  console.log(`[Upload-Agent] ✅ File uploaded successfully to: app/${blobName}`);

  // Generate SAS URL for secure access
  const expiresOn = new Date();
  expiresOn.setFullYear(expiresOn.getFullYear() + 1); // 1 year expiration

  try {
    const sasUrl = await blockBlobClient.generateSasUrl({
      permissions: BlobSASPermissions.parse("r"), // Read only
      expiresOn,
    });
    return sasUrl;
  } catch (error) {
    // Fallback to direct URL if SAS generation fails
    console.warn("Could not generate SAS token, using direct blob URL.", error);
    return blockBlobClient.url;
  }
}

/**
 * Delete an agent file from Azure Blob Storage
 * Files are stored at: agents/{agent_id}/{company_id}/{file_type}/{fileId}
 * or: agents/shared/{agent_id}/{file_type}/{fileId}
 * 
 * @param blobPath - The full blob path (e.g., "agents/shared/Agent-1/pdf/fileId" or "agents/Agent-1/companyId/pdf/fileId")
 */
export async function deleteAgentFileFromBlob(
  blobPath: string
): Promise<void> {
  const containerClient = await getAgentsContainerClient();
  
  // blobPath should already be in the format: agents/...
  // Remove "app/" prefix if present (shouldn't be, but handle it just in case)
  const cleanBlobPath = blobPath.startsWith("app/") ? blobPath.substring(4) : blobPath;
  
  console.log(`[Blob] Deleting blob from container 'app': ${cleanBlobPath}`);
  const blockBlobClient = containerClient.getBlockBlobClient(cleanBlobPath);

  const deleteResult = await blockBlobClient.deleteIfExists();
  if (deleteResult.succeeded) {
    console.log(`[Blob] Successfully deleted blob: ${cleanBlobPath}`);
  } else {
    // Blob doesn't exist - this is okay, it might have been deleted already
    // Log a warning but don't throw an error
    console.warn(`[Blob] Blob does not exist (may have been deleted already): ${cleanBlobPath}`);
  }
}
