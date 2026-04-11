import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { searchDocuments, formatSearchResultsAsContext } from "@/lib/azure-search";
import {
  findMatchedBlocklistTerms,
  generateBlockExplanation,
  generateGuardrailResponse,
  logGuardrailBlock,
} from "@/lib/guardrail";

/**
 * Get Azure AD access token for Azure AI Foundry
 * Uses OAuth 2.0 client credentials flow with ml.azure.com scope
 */
async function getFoundryAccessToken(): Promise<string> {
  const tenantId = process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID;
  const clientId = process.env.AUTH_MICROSOFT_ENTRA_ID_CLIENT_ID;
  const clientSecret = process.env.AUTH_MICROSOFT_ENTRA_ID_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error("Missing Microsoft Entra ID credentials");
  }

  // Use v2.0 endpoint with ml.azure.com scope!!!!!!!!!!!!!!!!!
  const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const scope = "https://ml.azure.com/.default"; //SUPER IMPORTANT: This scope is required for the Foundry API to work!!!!!!!!

  console.log('[ProxyCoach] Requesting Azure AD token with scope:', scope);

  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: scope,
      grant_type: "client_credentials",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[ProxyCoach] Token request failed: ${response.status}`, errorText);
    throw new Error(`Failed to get Azure AD token: ${response.status}`);
  }

  const data = await response.json();
  
  if (!data.access_token) {
    console.error('[ProxyCoach] No access_token in response');
    throw new Error('No access_token in token response');
  }
  
  console.log('[ProxyCoach] ✅ Token obtained successfully');
  return data.access_token;
}

/**
 * POST /api/agents/[agentId]/chat
 * 
 * ProxyCoach AI agent chat endpoint with:
 * - Azure AD authentication (required for Foundry agents)
 * - RAG (Retrieval Augmented Generation) using Azure AI Search
 * - Streaming responses
 * - Company data isolation
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await params;
    
    console.log('[ProxyCoach] ===== New Request =====');
    console.log('[ProxyCoach] Agent ID:', agentId);
    console.log('[ProxyCoach] Timestamp:', new Date().toISOString());

    // ===== AUTHENTICATION =====
    const session = await auth();
    if (!session?.user?.id) {
      console.log('[ProxyCoach] No authenticated session');
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // ===== GET USER & COMPANY =====
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, companyId: true },
    });

    if (!user || !user.companyId) {
      console.log('[ProxyCoach] User or company not found');
      return new Response(
        JSON.stringify({ error: "User or company not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log('[ProxyCoach] User:', user.id);
    console.log('[ProxyCoach] Company:', user.companyId);

    // ===== PARSE REQUEST =====
    const body = await req.json();
    const { messages, conversationId } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "Messages array is required and must not be empty" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log('[ProxyCoach] Messages count:', messages.length);
    
    // Log file attachments in messages
    messages.forEach((msg: any, index: number) => {
      if (msg.attachments && Array.isArray(msg.attachments) && msg.attachments.length > 0) {
        console.log(`[ProxyCoach] Message ${index} has ${msg.attachments.length} attachment(s):`, 
          msg.attachments.map((att: any) => ({
            fileName: att.fileName,
            fileType: att.fileType,
            hasExtractedText: !!att.extractedText,
            extractedTextLength: att.extractedText?.length || 0,
          }))
        );
      }
    });

    // ===== RAG SEARCH (Azure AI Search with Company Filter) =====
    // Pre-search Azure AI Search with companyId filter to get relevant documents
    // These filtered results are passed as context/resources to the agent
    // This ensures company data isolation and provides the agent with relevant documents
    const lastUserMessage = messages
      .slice()
      .reverse()
      .find((msg: { role: string }) => msg.role === "user");
    
    // Extract user message content for guardrail logging
    const userMessageContent = typeof lastUserMessage?.content === "string" 
      ? lastUserMessage.content 
      : JSON.stringify(lastUserMessage?.content || '');

    let ragContext = "";
    if (lastUserMessage?.content) {
      try {
        const query = typeof lastUserMessage.content === "string" 
          ? lastUserMessage.content 
          : JSON.stringify(lastUserMessage.content);
        
        console.log('[ProxyCoach] RAG search query:', query.substring(0, 100));
        console.log('[ProxyCoach] Filtering by companyId:', user.companyId, 'and shared documents');
        
        // Search with companyId filter - returns documents for this company AND shared documents
        const searchResults = await searchDocuments(query, user.companyId, 5);
        
        if (searchResults && searchResults.length > 0) {
          ragContext = formatSearchResultsAsContext(searchResults);
          const companyDocs = searchResults.filter(r => r.companyId === user.companyId).length;
          const sharedDocs = searchResults.filter(r => r.companyId === 'shared').length;
          console.log('[ProxyCoach] Found', searchResults.length, 'relevant documents:', companyDocs, 'company-specific,', sharedDocs, 'shared');
        } else {
          console.log('[ProxyCoach] No documents found in search for company:', user.companyId, 'or shared documents');
        }
      } catch (error) {
        console.error("[ProxyCoach] RAG search error:", error);
        // Continue without RAG context
      }
    }

    // ===== BUILD MESSAGES WITH DYNAMIC CONTEXT =====
    // Note: Static agent instructions are configured in Foundry Studio
    // Azure Foundry agents do NOT accept system messages in the input - only user/assistant messages
    // Pre-filtered search results are passed as context in the user message if needed
    
    // Prepare full message array with file attachments processed
    // Include RAG context in the last user message if available
    const chatMessages = messages.map((msg: any, index: number) => {
        let content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
        
        // Process file attachments
        if (msg.attachments && Array.isArray(msg.attachments) && msg.attachments.length > 0) {
          const attachmentTexts: string[] = [];
          
          for (const attachment of msg.attachments) {
            // For document files, include extracted text
            if (attachment.extractedText) {
              attachmentTexts.push(`\n\n[File: ${attachment.fileName}]\n${attachment.extractedText}`);
              console.log(`[ProxyCoach] Including extracted text from ${attachment.fileName} (${attachment.extractedText.length} chars)`);
            } else if (!attachment.fileType.startsWith("image/")) {
              // Document file without extracted text - mention the file
              attachmentTexts.push(`\n\n[File attached: ${attachment.fileName} (${attachment.fileType})]`);
              console.log(`[ProxyCoach] Document file ${attachment.fileName} has no extracted text`);
            }
            
            // For images, include a note about the image
            if (attachment.fileType.startsWith("image/") && attachment.fileUrl) {
              attachmentTexts.push(`\n\n[Image attached: ${attachment.fileName} - URL: ${attachment.fileUrl}]`);
              console.log(`[ProxyCoach] Image file attached: ${attachment.fileName}`);
            }
          }
          
          // Append attachment information to content
          if (attachmentTexts.length > 0) {
            content = content + attachmentTexts.join("\n");
          }
        }
        
        // Add RAG context to the last user message if this is the last message and it's a user message
        const isLastUserMessage = index === messages.length - 1 && msg.role === "user";
        if (isLastUserMessage && ragContext) {
          content = `${content}\n\n## Relevant Company Documents (Pre-filtered by companyId)\n${ragContext}\n\n## Important: Company Data Isolation\nIMPORTANT: Only reference documents and information for company: ${user.companyId}. All documents provided above have already been filtered to only include documents for this company.`;
        }
        
        return {
          role: msg.role as "user" | "assistant",
          content: content,
        };
      });

    console.log('[ProxyCoach] Total messages:', chatMessages.length);

    // ===== GET FOUNDRY ENDPOINT =====
    const responsesEndpoint = process.env.RESPONSES_API_ENDPOINT;
    if (!responsesEndpoint) {
      console.error('[ProxyCoach] RESPONSES_API_ENDPOINT not configured');
      return new Response(
        JSON.stringify({ error: "Agent endpoint not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log('[ProxyCoach] Foundry endpoint:', responsesEndpoint);

    // ===== AZURE AD AUTHENTICATION =====
    console.log('[ProxyCoach] Getting Azure AD access token...');
    const accessToken = await getFoundryAccessToken();
    console.log('[ProxyCoach] ✅ Access token obtained');

    // ===== PREPARE REQUEST =====
    // Azure Foundry Responses API requires "input" parameter (not "messages")
    // Each item must have a "type" field - for chat messages, use "message"
    // NOTE: Azure Foundry agents do NOT accept system messages - only user and assistant messages
    // chatMessages already excludes system messages, so no need to filter again
    const inputItems = chatMessages.map((msg) => ({
      type: "message",  // Required: specifies this is a chat message
      role: msg.role,   // user or assistant (no system messages)
      content: msg.content || "",  // Message content (ensure not undefined)
    }));

    console.log('[ProxyCoach] Prepared', inputItems.length, 'input items');

    const requestBody = JSON.stringify({
      input: inputItems,  // Use "input" parameter with typed items
      stream: true,       // Enable streaming responses
    });

    // Use Headers constructor for proper header handling!!!!!!!!!!!!!!!!!!!!
    const requestHeaders = new Headers();
    requestHeaders.set('Authorization', `Bearer ${accessToken}`);
    requestHeaders.set('Content-Type', 'application/json');
    
    console.log('[ProxyCoach] Request configured');
    console.log('[ProxyCoach] Body size:', requestBody.length, 'bytes');

    // ===== CALL FOUNDRY AGENT API =====
    console.log('[ProxyCoach] 🚀 Calling Foundry Agent Service...');
    
    const foundryResponse = await fetch(responsesEndpoint, {
      method: 'POST',
      headers: requestHeaders,
      body: requestBody,
    });

    console.log('[ProxyCoach] Response status:', foundryResponse.status);

    // ===== HANDLE API ERRORS =====
    if (!foundryResponse.ok) {
      const errorText = await foundryResponse.text();
      const responseHeaders: Record<string, string> = {};
      foundryResponse.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });
      
      console.error('[ProxyCoach] ❌ Foundry API error:', foundryResponse.status);
      console.error('[ProxyCoach] Status text:', foundryResponse.statusText);
      console.error('[ProxyCoach] Error body:', errorText || '(empty)');
      console.error('[ProxyCoach] Headers:', JSON.stringify(responseHeaders, null, 2));
      
      // Parse error JSON if available
      let errorDetails = errorText || 'No error details provided';
      let errorJson: any = null;
      try {
        if (errorText) {
          errorJson = JSON.parse(errorText);
          errorDetails = JSON.stringify(errorJson, null, 2);
        }
      } catch (e) {
        // Not JSON, use as-is
      }
      
      // Check if this might be a guardrail block (common status codes: 400, 429, 500 with specific error messages)
      const isPotentialGuardrailBlock = 
        foundryResponse.status === 400 || 
        foundryResponse.status === 429 ||
        (foundryResponse.status >= 500 && foundryResponse.status < 600) ||
        (errorText && (
          errorText.toLowerCase().includes('content') ||
          errorText.toLowerCase().includes('filter') ||
          errorText.toLowerCase().includes('safety') ||
          errorText.toLowerCase().includes('moderation') ||
          errorText.toLowerCase().includes('block') ||
          errorText.toLowerCase().includes('guardrail') ||
          errorText.toLowerCase().includes('policy')
        ));
      
      if (isPotentialGuardrailBlock) {
        await logGuardrailBlock('API_ERROR_RESPONSE', {
          userId: user.id,
          companyId: user.companyId || '',
          agentId,
          conversationId,
          userMessage: userMessageContent,
          finishReason: undefined,
          errorDetails: errorJson || errorText,
          metadata: {
            statusCode: foundryResponse.status,
            statusText: foundryResponse.statusText,
            headers: responseHeaders,
          },
        });
      }
      
      return new Response(
        JSON.stringify({ 
          error: `Agent API error: ${foundryResponse.status} ${foundryResponse.statusText}`,
          details: errorDetails,
          hint: foundryResponse.status === 401 
            ? "Authentication failed. Check if service principal has 'Azure AI User' role."
            : foundryResponse.status === 403
            ? "Access denied. Check if service principal has 'Azure AI User' role on the Foundry resource."
            : "Check error details for more information."
        }),
        { 
          status: foundryResponse.status, 
          headers: { "Content-Type": "application/json" } 
        }
      );
    }

    console.log('[ProxyCoach] ✅ Request successful, streaming response...');

    // ===== CHECK FOR BLOCKLIST MATCHES EARLY =====
    // Check user message for blocklist matches - needed for guardrail detection
    const matchedTerms = findMatchedBlocklistTerms(userMessageContent);
    const hasBlocklistMatch = matchedTerms.length > 0;
    
    // ===== CREATE STREAMING RESPONSE =====
    const encoder = new TextEncoder();
    
    // Track accumulated content for guardrail logging
    let accumulatedResponseContent = '';
    let guardrailBlockDetected = false;
    let guardrailResponseSent = false;
    
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const reader = foundryResponse.body?.getReader();
          if (!reader) {
            throw new Error('No response body available');
          }

          const decoder = new TextDecoder();
          let buffer = '';
          let chunkCount = 0;
          let streamComplete = false;
          let eventCount = 0;

          while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
              console.log('[ProxyCoach] ✅ Stream complete, chunks received:', chunkCount, 'events processed:', eventCount);
              if (chunkCount === 0 && eventCount > 0) {
                console.warn('[ProxyCoach] No content was extracted from', eventCount, 'event(s). Foundry may use event types we do not parse for content.');
              }
              if (chunkCount === 0 && eventCount === 0) {
                console.warn('[ProxyCoach] Stream ended with no data lines received. Foundry may have returned an empty or non-SSE response.');
              }
              
              // If guardrail block was detected but response wasn't sent yet, send it now
              // This only happens if blocked: true AND blocklist match (guardrailBlockDetected = true)
              if (guardrailBlockDetected && !guardrailResponseSent && hasBlocklistMatch) {
                const matchedTerm = matchedTerms[0];
                const guardrailMessage = generateGuardrailResponse(matchedTerm);
                
                const sentences = guardrailMessage.split(/(?<=[.!?])\s+/).filter(s => s.trim());
                if (sentences.length > 0) {
                  for (let i = 0; i < sentences.length; i++) {
                    const sentence = i === 0 ? sentences[i] : ' ' + sentences[i];
                    const chunkData = JSON.stringify({ content: sentence, done: false });
                    controller.enqueue(encoder.encode(`data: ${chunkData}\n\n`));
                  }
                } else {
                  const chunkData = JSON.stringify({ content: guardrailMessage, done: false });
                  controller.enqueue(encoder.encode(`data: ${chunkData}\n\n`));
                }
                
                guardrailResponseSent = true;
              }
              
              break;
            }

            // Decode and buffer incoming data
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            // Process each line
            for (const line of lines) {
              // DEBUG: Log every raw line received
              if (line.trim()) {
                console.log('[ProxyCoach] Raw line:', line.substring(0, 200));
              }
              
              if (line.startsWith('data: ')) {
                const data = line.slice(6).trim();
                
                // DEBUG: Log the data chunk
                console.log('[ProxyCoach] Data chunk:', data.substring(0, 200));
                
                // Check for stream end
                if (data === '[DONE]') {
                  console.log('[ProxyCoach] Received [DONE] signal');
                  const doneData = JSON.stringify({ content: "", done: true });
                  controller.enqueue(encoder.encode(`data: ${doneData}\n\n`));
                  controller.close();
                  return;
                }
                
                // Parse and forward content chunks
                try {
                  const parsed = JSON.parse(data);
                  eventCount++;
                  
                  // Handle error events
                  if (parsed.type === 'error') {
                    console.error('[ProxyCoach] Foundry error:', parsed.error);
                    const errorMessage = parsed.error?.message || 'An error occurred';
                    const errorData = JSON.stringify({
                      error: errorMessage,
                      done: true,
                    });
                    controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
                    controller.close();
                    return;
                  }
                  
                  // Handle response.failed events
                  if (parsed.type === 'response.failed') {
                    console.error('[ProxyCoach] Response failed:', parsed.response?.status);
                    const errorMessage = parsed.response?.error?.message || 'Response failed';
                    const errorData = JSON.stringify({
                      error: errorMessage,
                      done: true,
                    });
                    controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
                    controller.close();
                    return;
                  }
                  
                  // Skip logging response.output_text.done - it's just a summary, we ignore it for content
                  // This reduces log noise since we've already processed all deltas
                  const isDoneEvent = parsed.type === 'response.output_text.done';
                  
                  // Skip response.output_text.done - it's just a summary, we've already sent all deltas
                  // This prevents duplication and ensures proper streaming like basic chat
                  if (isDoneEvent) {
                    continue; // Skip this event entirely - don't extract or send any content
                  }
                  
                  // DEBUG: Log the parsed object structure (skip done events to reduce noise)
                  console.log('[ProxyCoach] Parsed structure:', JSON.stringify(parsed, null, 2).substring(0, 500));
                  
                  // Extract content - focus on Foundry's delta format (like basic chat focuses on delta.content)
                  let content = '';
                  
                  // Primary format: Foundry response.output_text.delta (main streaming format)
                  // delta is the string content directly
                  if (parsed.type === 'response.output_text.delta' && typeof parsed.delta === 'string') {
                    content = parsed.delta;
                  }
                  // Extract content from response.output_item.done events (item.content array format)
                  else if (parsed.type === 'response.output_item.done' && parsed.item?.content) {
                    // response.output_item.done may contain final content in item.content array
                    const contentArray = Array.isArray(parsed.item.content) ? parsed.item.content : [parsed.item.content];
                    const textParts = contentArray
                      .filter((item: any) => item?.type === 'output_text' && item?.text)
                      .map((item: any) => item.text);
                    if (textParts.length > 0) {
                      content = textParts.join('\n');
                    }
                  }
                  // Extract content from response.incomplete events (content array format)
                  else if (parsed.type === 'response.incomplete' && parsed.response?.content) {
                    // response.incomplete may contain content in an array format
                    const contentArray = Array.isArray(parsed.response.content) ? parsed.response.content : [parsed.response.content];
                    const textParts = contentArray
                      .filter((item: any) => item?.type === 'output_text' && item?.text)
                      .map((item: any) => item.text);
                    if (textParts.length > 0) {
                      content = textParts.join('\n');
                    }
                  }
                  // Fallback formats for compatibility
                  else if (parsed.choices?.[0]?.delta?.content) {
                    content = parsed.choices[0].delta.content;
                  }
                  else if (parsed.delta?.content) {
                    content = parsed.delta.content;
                  }
                  else if (parsed.content) {
                    content = parsed.content;
                  }
                  
                  // Check for guardrail block: blocked: true AND blocklist match
                  const foundryContentFilters = parsed.response?.content_filters || parsed.item?.content_filters;
                  const hasBlocked = foundryContentFilters && 
                    Array.isArray(foundryContentFilters) &&
                    foundryContentFilters.some((filter: any) => filter.blocked === true);
                  
                  // SIMPLIFIED: Only block if BOTH conditions are met:
                  // 1. Foundry blocked it (blocked: true)
                  // 2. User message matches blocklist (escalation needed)
                  const shouldBlock = hasBlocked && hasBlocklistMatch;
                  
                  if (content) {
                    // Filter out Foundry's default guardrail messages
                    const foundryDefaultMessages = [
                      "I'm sorry, but I cannot assist with that request.",
                      "I'm sorry, I cannot help with that.",
                      "I cannot assist with that request.",
                      "I'm unable to assist with that.",
                    ];
                    const isFoundryDefaultMessage = foundryDefaultMessages.some(msg => 
                      content.trim().toLowerCase().includes(msg.toLowerCase())
                    );
                    
                    // Block content if guardrail detected OR Foundry's default message
                    if (shouldBlock || isFoundryDefaultMessage) {
                      accumulatedResponseContent += content; // Track for logging
                      continue; // Skip - we'll send custom guardrail message
                    }
                    
                    // Send content normally
                    chunkCount++;
                    accumulatedResponseContent += content;
                    const chunkData = JSON.stringify({ content, done: false });
                    controller.enqueue(encoder.encode(`data: ${chunkData}\n\n`));
                  } else {
                    console.log('[ProxyCoach] No content found in chunk, keys:', Object.keys(parsed));
                  }
                  
                  // Handle guardrail block - ONLY when blocked: true AND blocklist match
                  // This is the ONLY condition where we break early
                  if (shouldBlock && !guardrailBlockDetected) {
                    console.log('[ProxyCoach] 🚫 Guardrail block detected - blocked: true + blocklist match');
                    guardrailBlockDetected = true;
                    
                    // Log escalation (creates escalation incident in database)
                    const matchedTerm = matchedTerms[0];
                    await logGuardrailBlock('GUARDRAIL_BLOCK_DETECTED', {
                      userId: user.id,
                      companyId: user.companyId || '',
                      agentId,
                      conversationId,
                      userMessage: userMessageContent,
                      responseContent: accumulatedResponseContent,
                      finishReason: 'content_filter_blocked',
                      metadata: {
                        responseStatus: parsed.response?.status,
                        foundryContentFilters: foundryContentFilters,
                      },
                    });
                    
                    // Send custom guardrail message
                    if (!guardrailResponseSent) {
                      const guardrailMessage = generateGuardrailResponse(matchedTerm);
                      const sentences = guardrailMessage.split(/(?<=[.!?])\s+/).filter(s => s.trim());
                      
                      if (sentences.length > 0) {
                        for (let i = 0; i < sentences.length; i++) {
                          const sentence = i === 0 ? sentences[i] : ' ' + sentences[i];
                          const chunkData = JSON.stringify({ content: sentence, done: false });
                          controller.enqueue(encoder.encode(`data: ${chunkData}\n\n`));
                        }
                      } else {
                        const chunkData = JSON.stringify({ content: guardrailMessage, done: false });
                        controller.enqueue(encoder.encode(`data: ${chunkData}\n\n`));
                      }
                      
                      guardrailResponseSent = true;
                    }
                    
                    // Break stream - guardrail block requires escalation
                    // This is the ONLY place we break early
                    streamComplete = true;
                    break;
                  }
                  
                  // For all other cases, continue processing
                  // Don't break on completion signals - let stream continue until [DONE] or reader.done
                  // This ensures all content is sent before completion
                  // Log completion signals for debugging but don't break
                  if (parsed.type === 'response.done' || 
                      (parsed.response?.status === 'complete') ||
                      (parsed.type === 'response.output_item.done' && parsed.item?.status === 'complete')) {
                    console.log('[ProxyCoach] Completion signal detected (continuing):', parsed.type, parsed.response?.status || parsed.item?.status);
                  }
                } catch (e) {
                  // Skip invalid JSON lines but log the error
                  console.warn('[ProxyCoach] Failed to parse JSON:', e);
                  console.warn('[ProxyCoach] Invalid data was:', data.substring(0, 100));
                }
              } else if (line.trim() && !line.startsWith(':')) {
                // Log any non-data, non-comment lines
                console.log('[ProxyCoach] Non-data line:', line.substring(0, 100));
              }
            }
          }

          // If guardrail was detected but no response was sent, send it now
          // Only do this if we actually detected a block from Foundry AND there's a blocklist match
          // Only send guardrail message if there's an actual block and we haven't sent it yet
          if (guardrailBlockDetected && !guardrailResponseSent) {
            // Extract terms from CSV file to identify which term caused the block
            const matchedTerms = findMatchedBlocklistTerms(userMessageContent);
            // Only proceed if there's actually a blocklist match
            if (matchedTerms.length > 0) {
              const matchedTerm = matchedTerms[0];
              const guardrailMessage = generateGuardrailResponse(matchedTerm);
              
              // Send the guardrail message as sentence chunks for better streaming
              const sentences = guardrailMessage.split(/(?<=[.!?])\s+/).filter(s => s.trim());
              if (sentences.length > 0) {
                for (let i = 0; i < sentences.length; i++) {
                  const sentence = i === 0 ? sentences[i] : ' ' + sentences[i];
                  const chunkData = JSON.stringify({ content: sentence, done: false });
                  controller.enqueue(encoder.encode(`data: ${chunkData}\n\n`));
                }
              } else {
                // Fallback: send entire message if no sentence breaks
                const chunkData = JSON.stringify({ content: guardrailMessage, done: false });
                controller.enqueue(encoder.encode(`data: ${chunkData}\n\n`));
              }
              
              guardrailResponseSent = true;
            }
            // If no blocklist match, don't send guardrail response (Azure content filter false positive)
          }
          
          // For false positives, we let the content through (already handled above)
          // No need to send error messages - the agent's response should be shown
          
          // If no guardrail block was detected, let the normal response flow through
          
          // Send final completion signal
          const doneData = JSON.stringify({ content: "", done: true });
          controller.enqueue(encoder.encode(`data: ${doneData}\n\n`));
          controller.close();
          
        } catch (error) {
          console.error("[ProxyCoach] Streaming error:", error);
          
          // Check if error might be related to guardrail blocks
          const errorMessage = error instanceof Error ? error.message : String(error);
          const isPotentialGuardrailError = 
            errorMessage.toLowerCase().includes('content') ||
            errorMessage.toLowerCase().includes('filter') ||
            errorMessage.toLowerCase().includes('safety') ||
            errorMessage.toLowerCase().includes('moderation') ||
            errorMessage.toLowerCase().includes('block') ||
            errorMessage.toLowerCase().includes('guardrail') ||
            errorMessage.toLowerCase().includes('policy');
          
          if (isPotentialGuardrailError) {
            await logGuardrailBlock('STREAMING_ERROR', {
              userId: user.id,
              companyId: user.companyId || '',
              agentId,
              conversationId,
              userMessage: userMessageContent,
              responseContent: accumulatedResponseContent,
              errorDetails: {
                message: errorMessage,
                stack: error instanceof Error ? error.stack : undefined,
                error: error,
              },
            });
          }
          
          const errorData = JSON.stringify({
            error: errorMessage,
            done: true,
          });
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
          controller.close();
        }
      },
    });

    // ===== RETURN STREAMING RESPONSE =====
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
    
  } catch (error) {
    console.error("[ProxyCoach] ❌ Unexpected error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "An unexpected error occurred",
        stack: error instanceof Error ? error.stack : undefined,
      }),
      { 
        status: 500, 
        headers: { "Content-Type": "application/json" } 
      }
    );
  }
}