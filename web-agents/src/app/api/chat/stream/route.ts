import { NextRequest } from "next/server";
import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

/**
 * Streaming chat API route
 * 
 * Handles streaming chat requests to Azure OpenAI
 * 
 * Expected environment variables:
 * - AZURE_BASICLLM_OPENAI_TARGET_URL: Your Azure OpenAI endpoint
 *   Option 1 (Full URL): https://{resource}.cognitiveservices.azure.com/openai/deployments/{deployment}?api-version={version}
 *   Option 2 (Base URL): https://{resource}.cognitiveservices.azure.com (will construct deployment path)
 * - AZURE_BASICLLM_OPENAI_API_KEY: Your Azure OpenAI API key
 * - AZURE_BASICLLM_DEPLOYMENT_NAME: Your deployment name (required if using base URL, ignored if using full URL)
 */

export async function POST(req: NextRequest) {
  try {
    // Validate environment variables
    const endpoint = process.env.AZURE_BASICLLM_OPENAI_TARGET_URL;
    const apiKey = process.env.AZURE_BASICLLM_OPENAI_API_KEY;
    const deploymentName = process.env.AZURE_BASICLLM_DEPLOYMENT_NAME;

    if (!endpoint || !apiKey || !deploymentName) {
      return new Response(
        JSON.stringify({
          error: "Missing required environment variables. Please configure AZURE_BASICLLM_OPENAI_TARGET_URL, AZURE_BASICLLM_OPENAI_API_KEY, and AZURE_BASICLLM_DEPLOYMENT_NAME",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Log configuration for debugging (remove sensitive data in production)
    console.log(`[Azure OpenAI] Endpoint: ${endpoint}`);
    console.log(`[Azure OpenAI] Deployment: ${deploymentName}`);
    console.log(`[Azure OpenAI] API Key: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}`);

    // Parse request body
    let body;
    try {
      body = await req.json();
    } catch (error) {
      return new Response(
        JSON.stringify({ error: "Invalid JSON in request body" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const { messages } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "Messages array is required and must not be empty" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    /**
     * Helper function to format messages for Azure OpenAI
     * Messages may already be formatted by the client (with content as array for Vision API)
     * or may need simple formatting (content as string)
     */
    const formatMessageForAzure = (msg: {
      role: string;
      content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
      attachments?: Array<{
        fileName?: string;
        fileType: string;
        dataUrl?: string;
        fileUrl?: string;
        extractedText?: string;
      }>;
    }): ChatCompletionMessageParam => {
      const role = msg.role as "system" | "user" | "assistant";
      
      // If content is already an array (formatted by client), validate and use it
      if (Array.isArray(msg.content)) {
        // Validate and map to the correct OpenAI format
        const contentArray: Array<
          | { type: "text"; text: string }
          | { type: "image_url"; image_url: { url: string } }
        > = msg.content.map((item) => {
          if (item.type === "text" && item.text) {
            return { type: "text" as const, text: item.text };
          } else if (item.type === "image_url" && item.image_url?.url) {
            return { type: "image_url" as const, image_url: { url: item.image_url.url } };
          }
          // Fallback: if it's not properly formatted, try to extract text
          if (item.text) {
            return { type: "text" as const, text: item.text };
          }
          throw new Error(`Invalid content item: ${JSON.stringify(item)}`);
        });
        
        // Check if there are document attachments that need to be included
        const documentAttachments = msg.attachments?.filter(
          (att) => !att.fileType.startsWith("image/") && att.extractedText
        ) || [];
        
        if (documentAttachments.length > 0) {
          // Find the text item in the array, or create one
          let textItem = contentArray.find(item => item.type === "text");
          const documentTexts = documentAttachments.map((doc) => {
            const fileName = doc.fileUrl?.split("/").pop() || "document";
            return `\n\n[Content from ${fileName}]:\n${doc.extractedText}`;
          });
          const appendedText = documentTexts.join("\n\n");
          
          if (textItem) {
            // Append to existing text item
            textItem.text += appendedText;
          } else {
            // Create a new text item at the beginning
            contentArray.unshift({
              type: "text",
              text: appendedText.trim(),
            });
          }
        }
        
        return {
          role,
          content: contentArray,
        } as ChatCompletionMessageParam;
      }

      // If content is a string and there are no attachments, return simple format
      if (!msg.attachments || msg.attachments.length === 0) {
        return {
          role,
          content: msg.content as string,
        } as ChatCompletionMessageParam;
      }

      // Separate image and document attachments
      const imageAttachments = (msg.attachments || []).filter(
        (att) => att.fileType.startsWith("image/")
      );
      const documentAttachments = (msg.attachments || []).filter(
        (att) => !att.fileType.startsWith("image/") && att.extractedText
      );
      
      // Log for debugging
      if (documentAttachments.length > 0) {
        console.log(`[Chat Stream] Found ${documentAttachments.length} document attachment(s) with extracted text`);
        documentAttachments.forEach((doc, idx) => {
          console.log(`[Chat Stream] Document ${idx + 1}: ${doc.fileName}, extractedText length: ${doc.extractedText?.length || 0}`);
        });
      } else if (msg.attachments && msg.attachments.length > 0) {
        console.log(`[Chat Stream] Found ${msg.attachments.length} attachment(s) but no extracted text`);
        msg.attachments.forEach((att, idx) => {
          console.log(`[Chat Stream] Attachment ${idx + 1}: ${att.fileName}, type: ${att.fileType}, has extractedText: ${!!att.extractedText}`);
        });
      }

      // Build the message content
      let messageContent = typeof msg.content === "string" ? msg.content : "";
      
      // Append extracted text from document files
      if (documentAttachments.length > 0) {
        const documentTexts = documentAttachments.map((doc) => {
          const fileName = doc.fileUrl?.split("/").pop() || doc.fileName || "document";
          return `\n\n[Content from ${fileName}]:\n${doc.extractedText}`;
        });
        messageContent += documentTexts.join("\n\n");
        
        // If original message was empty, ensure we have at least the document content
        if (!messageContent.trim() && documentTexts.length > 0) {
          messageContent = documentTexts.join("\n\n").trim();
        }
      }

      // If there are images, format for Vision API
      if (imageAttachments.length > 0) {
        const contentArray: Array<
          | { type: "text"; text: string }
          | { type: "image_url"; image_url: { url: string } }
        > = [];

        // Add text content (including extracted document text)
        // Always include text if there's any content, even if original message was empty
        if (messageContent.trim() || documentAttachments.length > 0) {
          contentArray.push({
            type: "text",
            text: messageContent.trim() || documentAttachments.map(doc => `[Content from ${doc.fileName || "document"}]:\n${doc.extractedText}`).join("\n\n"),
          });
        }

        // Add image URLs
        for (const image of imageAttachments) {
          const imageUrl = image.dataUrl || image.fileUrl;
          if (imageUrl && typeof imageUrl === "string") {
            contentArray.push({
              type: "image_url",
              image_url: {
                url: imageUrl,
              },
            });
          }
        }

        return {
          role,
          content: contentArray,
        } as ChatCompletionMessageParam;
      }

      // If only documents (no images), return text format with extracted content
      if (documentAttachments.length > 0) {
        return {
          role,
          content: messageContent,
        } as ChatCompletionMessageParam;
      }

      // Fallback: no images or documents with extracted text
      return {
        role,
        content: typeof msg.content === "string" ? msg.content : "",
      } as ChatCompletionMessageParam;
    };

    // Initialize Azure OpenAI client
    // Support both full target URL and base endpoint construction
    let baseURL: string;
    let apiVersion = "2024-12-01-preview"; // default
    
    // Check if endpoint is already a full deployment URL (contains /openai/deployments/)
    if (endpoint.includes("/openai/deployments/")) {
      // Extract API version from query string if present
      try {
        const urlObj = new URL(endpoint);
        const versionParam = urlObj.searchParams.get("api-version");
        if (versionParam) {
          apiVersion = versionParam;
        }
      } catch (e) {
        // If URL parsing fails, continue with default version
      }
      
      // Extract base URL up to the deployment path (remove /chat/completions and query params)
      // baseURL should be: https://.../openai/deployments/{deployment}
      const cleanEndpoint = endpoint.split("?")[0]; // Remove query params
      const chatCompletionsIndex = cleanEndpoint.indexOf("/chat/completions");
      if (chatCompletionsIndex !== -1) {
        // Remove /chat/completions if present (SDK adds this automatically)
        baseURL = cleanEndpoint.substring(0, chatCompletionsIndex);
      } else {
        // Extract up to deployment name (remove any trailing paths)
        const deploymentMatch = cleanEndpoint.match(/^(.*\/openai\/deployments\/[^\/]+)/);
        baseURL = deploymentMatch ? deploymentMatch[1] : cleanEndpoint.replace(/\/+$/, "");
      }
    } else {
      // Construct URL from base endpoint (legacy behavior)
      const endpointUrl = endpoint.endsWith("/") ? endpoint.slice(0, -1) : endpoint;
      baseURL = `${endpointUrl}/openai/deployments/${deploymentName}`;
    }
    
    // Azure OpenAI configuration
    // baseURL should be: {endpoint}/openai/deployments/{deployment}
    // The model parameter in create() call should be the deployment name
    const client = new OpenAI({
      apiKey: apiKey,
      baseURL: baseURL,
      defaultQuery: { "api-version": apiVersion },
      // Azure OpenAI requires 'api-key' header, not 'Authorization: Bearer'
      // Override the default authentication using custom fetch
      fetch: async (url: RequestInfo | URL, init?: RequestInit) => {
        // Clone init to avoid mutating the original
        const fetchInit: RequestInit = { ...init };
        const headers = new Headers(init?.headers || {});
        
        // Remove Authorization header (openai package adds "Bearer {key}" by default)
        headers.delete("authorization");
        headers.delete("Authorization");
        
        // Azure OpenAI requires 'api-key' header
        headers.set("api-key", apiKey);
        
        // Set the modified headers
        fetchInit.headers = headers;
        
        // Log for debugging (remove in production)
        const urlString = typeof url === 'string' ? url : url.toString();
        console.log(`[Azure OpenAI] Request URL: ${urlString}`);
        console.log(`[Azure OpenAI] Using api-key header`);
        
        const response = await fetch(url, fetchInit);
        
        // Log response status for debugging (don't read body - let openai package handle it)
        if (!response.ok) {
          // Clone the response to read error details without consuming the original body
          const clonedResponse = response.clone();
          clonedResponse.text().then((errorText) => {
            console.error(`[Azure OpenAI] Request failed: ${response.status} ${response.statusText}`);
            console.error(`[Azure OpenAI] Error response:`, errorText.substring(0, 500));
          }).catch(() => {
            // Ignore errors reading error body for logging
          });
        }
        
        return response;
      },
    });

    // Create a readable stream for SSE
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Format messages for Azure OpenAI
          // Messages from useChat are already formatted for Vision API if they have attachments
          let chatMessages = messages.map(formatMessageForAzure);

          // Optimize token usage: Limit conversation history to last 20 messages
          // This prevents sending very long conversations (which increases input tokens)
          // For most chat use cases, recent context is most important
          const MAX_HISTORY_MESSAGES = 20;
          if (chatMessages.length > MAX_HISTORY_MESSAGES) {
            // Keep the first message (if system) and the last N messages
            const firstMessage = chatMessages[0]?.role === "system" ? [chatMessages[0]] : [];
            const recentMessages = chatMessages.slice(-MAX_HISTORY_MESSAGES + (firstMessage.length > 0 ? 1 : 0));
            chatMessages = [...firstMessage, ...recentMessages];
          }

          // Stream the completion
          // When baseURL includes deployment, model parameter can be the deployment name or empty
          // Note: gpt-5.2-chat only supports default temperature (1), not custom values
          const chatStream = await client.chat.completions.create({
            model: deploymentName,
            messages: chatMessages,
            // Reduced to 2000 tokens for better cost efficiency
            // This is still plenty for most chat responses, and the model stops when done
            max_completion_tokens: 2000,
            stream: true,
          });

          // Stream each chunk
          for await (const chunk of chatStream) {
            const choice = chunk.choices?.[0];
            if (choice?.delta?.content) {
              // Send content chunk as SSE
              const data = JSON.stringify({
                content: choice.delta.content,
                done: false,
              });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
            
            // Check if stream is complete
            if (choice?.finish_reason) {
              break;
            }
          }

          // Send completion signal
          const doneData = JSON.stringify({ content: "", done: true });
          controller.enqueue(encoder.encode(`data: ${doneData}\n\n`));
          controller.close();
        } catch (error) {
          console.error("Error streaming chat completion:", error);
          const errorData = JSON.stringify({
            error: error instanceof Error ? error.message : "An error occurred while streaming",
            done: true,
          });
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
          controller.close();
        }
      },
    });

    // Return the stream with proper SSE headers
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    console.error("Error in chat stream API:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "An unexpected error occurred",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

