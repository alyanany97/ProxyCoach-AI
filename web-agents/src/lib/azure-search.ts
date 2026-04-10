import { SearchClient, AzureKeyCredential } from "@azure/search-documents";
import OpenAI from "openai";
import { createHash } from "crypto";

/**
 * Azure AI Search configuration
 * 
 * Required environment variables:
 * - SEARCH_ENDPOINT: Your Azure AI Search endpoint
 * - SEARCH_API_KEY: Your Azure AI Search API key
 * - LEGAL_LEO_SEARCH_INDEX_NAME: The name of your search index
 * - AZURE_OPENAI_EMBEDDING_TARGET_URL: Azure OpenAI endpoint for embeddings (e.g., https://agents-develop-resource.cognitiveservices.azure.com)
 * - AZURE_AGENTS_API_KEY: Azure OpenAI API key
 * - AZURE_OPENAI_EMBEDDING_DEPLOYMENT: Embedding model deployment name (default: "semantic-search-embedding")
 */

interface SearchResult {
  id: string;
  content: string;
  fileName?: string;
  fileType?: string;
  companyId?: string;
  score: number;
}

/**
 * Get Azure AI Search client
 */
function getSearchClient(): SearchClient<Record<string, unknown>> {
  const endpoint = process.env.SEARCH_ENDPOINT;
  const apiKey = process.env.SEARCH_API_KEY;
  const indexName = process.env.LEGAL_LEO_SEARCH_INDEX_NAME;

  if (!endpoint || !apiKey || !indexName) {
    throw new Error(
      "Azure AI Search configuration missing. Provide SEARCH_ENDPOINT, SEARCH_API_KEY, and LEGAL_LEO_SEARCH_INDEX_NAME"
    );
  }

  return new SearchClient<Record<string, unknown>>(
    endpoint,
    indexName,
    new AzureKeyCredential(apiKey)
  );
}

/**
 * Generate embedding for a query using Azure OpenAI
 */
async function generateQueryEmbedding(query: string): Promise<number[]> {
  const endpoint = process.env.AZURE_OPENAI_EMBEDDING_TARGET_URL;
  const apiKey = process.env.AZURE_AGENTS_API_KEY;
  const deploymentName = process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT || "semantic-search-embedding";

  if (!endpoint || !apiKey) {
    throw new Error(
      "Azure OpenAI configuration missing for embeddings. Provide AZURE_OPENAI_EMBEDDING_TARGET_URL and AZURE_AGENTS_API_KEY"
    );
  }

  const endpointUrl = endpoint.endsWith("/") ? endpoint.slice(0, -1) : endpoint;
  
  const client = new OpenAI({
    apiKey: apiKey,
    baseURL: `${endpointUrl}/openai/deployments/${deploymentName}`,
    defaultQuery: { "api-version": "2024-02-01" },
    fetch: async (url: RequestInfo | URL, init?: RequestInit) => {
      const fetchInit: RequestInit = { ...init };
      const headers = new Headers(init?.headers || {});
      headers.delete("authorization");
      headers.delete("Authorization");
      headers.set("api-key", apiKey);
      fetchInit.headers = headers;
      return fetch(url, fetchInit);
    },
  });

  const response = await client.embeddings.create({
    model: deploymentName,
    input: query,
  });

  return response.data[0].embedding;
}

/**
 * Search for relevant documents using vector search
 * 
 * @param query - The search query
 * @param companyId - Optional company ID to filter results. When provided, searches both company-specific and shared documents.
 * @param top - Number of results to return (default: 3)
 * @returns Array of search results
 */
export async function searchDocuments(
  query: string,
  companyId?: string | null,
  top: number = 3
): Promise<SearchResult[]> {
  try {
    const searchClient = getSearchClient();
    
    // Generate embedding for the query
    const queryVector = await generateQueryEmbedding(query);

    // Build filter for company ID if provided
    // Include both company-specific documents and shared documents (companyId eq 'shared')
    let filter: string | undefined;
    if (companyId) {
      filter = `(companyId eq '${companyId}' or companyId eq 'shared')`;
    }

    // Perform vector search
    const searchResults = await searchClient.search(undefined, {
      vectorSearchOptions: {
        queries: [
          {
            kind: "vector",
            vector: queryVector,
            kNearestNeighborsCount: top,
            fields: ["contentVector"],
          },
        ],
      },
      filter,
      top,
      select: ["id", "content", "fileName", "fileType", "companyId"],
    });

    const results: SearchResult[] = [];
    for await (const result of searchResults.results) {
      if (result.score !== undefined) {
        results.push({
          id: result.document.id as string,
          content: result.document.content as string,
          fileName: result.document.fileName as string | undefined,
          fileType: result.document.fileType as string | undefined,
          companyId: result.document.companyId as string | undefined,
          score: result.score,
        });
      }
    }

    return results;
  } catch (error) {
    console.error("Error searching documents:", error);
    throw error;
  }
}

/**
 * Format search results as context for the LLM
 * 
 * @param results - Search results from vector search
 * @returns Formatted context string
 */
export function formatSearchResultsAsContext(results: SearchResult[]): string {
  if (results.length === 0) {
    return "";
  }

  const contextParts = results.map((result, index) => {
    const fileName = result.fileName || "Unknown file";
    return `[Document ${index + 1}: ${fileName}]\n${result.content.substring(0, 2000)}...`;
  });

  return `\n\nRelevant context from uploaded documents:\n${contextParts.join("\n\n")}`;
}

/**
 * Delete documents from Azure AI Search index by file path or source document ID
 * 
 * @param companyId - Company ID
 * @param fileId - File ID
 * @param filePath - Optional file path (blob path)
 * @returns Number of documents deleted
 */
export async function deleteDocumentsFromIndex(
  companyId: string | null,
  fileId: string,
  filePath?: string
): Promise<number> {
  try {
    const searchClient = getSearchClient();
    
    // Generate the base document ID (same as used in function app)
    const companyFolder = companyId || "No_Company_Assigned";
    const baseDocumentId = createHash('md5')
      .update(`${companyFolder}_${fileId}`)
      .digest('hex');
    
    // Clean filePath - remove query string parameters if present
    let cleanFilePath = filePath;
    if (filePath) {
      // Remove query string (everything after ?)
      cleanFilePath = filePath.split('?')[0];
    }
    
    // Build filter query to find all chunks for this document
    // We search by:
    // 1. sourceDocumentId (for chunked documents)
    // 2. filePath (exact match, without query string)
    // 3. fileName (for older documents that might not have sourceDocumentId)
    let filterQuery = `sourceDocumentId eq '${baseDocumentId}'`;
    if (cleanFilePath) {
      filterQuery += ` or filePath eq '${cleanFilePath}'`;
    }
    // Also search by fileName as fallback for older documents
    filterQuery += ` or fileName eq '${fileId}'`;
    
    console.log(`[Search] Deleting documents with filter: ${filterQuery}`);
    console.log(`[Search] Base document ID: ${baseDocumentId}, File ID: ${fileId}, Clean path: ${cleanFilePath}`);
    
    // Search for all matching documents (chunks)
    const searchResults = await searchClient.search("*", {
      filter: filterQuery,
      select: ["id"],
      top: 1000, // Get up to 1000 chunks
    });
    
    const documentIdsToDelete: string[] = [];
    
    for await (const result of searchResults.results) {
      const docId = result.document.id as string;
      if (docId) {
        documentIdsToDelete.push(docId);
      }
    }
    
    if (documentIdsToDelete.length === 0) {
      console.log(`[Search] No documents found to delete for file: ${fileId}`);
      return 0;
    }
    
    console.log(`[Search] Found ${documentIdsToDelete.length} document(s) to delete`);
    
    // Delete all matching documents
    const documentsToDelete = documentIdsToDelete.map(id => ({ id }));
    const deleteResults = await searchClient.deleteDocuments(documentsToDelete);
    
    let succeeded = 0;
    let failed = 0;
    
    for (const result of deleteResults.results) {
      if (result.succeeded) {
        succeeded++;
      } else {
        failed++;
        console.error(`[Search] Failed to delete document: ${result.errorMessage}`);
      }
    }
    
    if (failed > 0) {
      console.warn(`[Search] Partial deletion: ${succeeded} succeeded, ${failed} failed`);
    } else {
      console.log(`[Search] Successfully deleted ${succeeded} document(s) from index`);
    }
    
    return succeeded;
  } catch (error) {
    console.error("[Search] Error deleting documents from index:", error);
    throw error;
  }
}