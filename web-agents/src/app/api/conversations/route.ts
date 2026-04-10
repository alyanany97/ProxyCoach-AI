import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

/**
 * GET /api/conversations
 * Get all conversations for the current user (if logged in) or session (if anonymous)
 */
export async function GET(req: NextRequest) {
  try {
    // Get authenticated user
    const session = await auth();
    const userId = session?.user?.id;
    
    // Get session ID for anonymous users
    const sessionId = req.headers.get("x-session-id") || req.nextUrl.searchParams.get("sessionId");

    // Must have either userId (logged in) or sessionId (anonymous)
    if (!userId && !sessionId) {
      return new Response(
        JSON.stringify({ error: "Authentication or session ID is required" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Get agentId from query params if provided
    const agentIdParam = req.nextUrl.searchParams.get("agentId");
    
    // Fetch conversations - use userId if logged in, otherwise sessionId
    // Filter by agentId if provided (null agentId means basic LLM conversations)
    const whereClause: any = userId 
      ? { userId: userId }
      : { sessionId: sessionId };
    
    // Add agentId filter
    // If agentId param is present (even if empty string), filter by it
    if (agentIdParam !== null) {
      if (agentIdParam === "") {
        // Empty string means basic LLM conversations (agentId is null)
        whereClause.agentId = null;
      } else {
        // Specific agent ID
        whereClause.agentId = agentIdParam;
      }
    }
    // If agentId param is not present (null), don't filter by agentId (get all conversations)
    
    const conversations = await prisma.conversation.findMany({
      where: whereClause,
      orderBy: {
        updatedAt: "desc",
      },
      include: {
        messages: {
          orderBy: {
            createdAt: "asc",
          },
          take: 1, // Just get the first message for preview
        },
      },
    });

    // Format for frontend
    const formattedConversations = conversations.map((conv) => ({
      id: conv.id,
      title: conv.title,
      timestamp: conv.updatedAt,
      preview: conv.messages[0]?.content?.substring(0, 100) || "",
    }));

    return Response.json(formattedConversations);
  } catch (error) {
    console.error("Error fetching conversations:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Failed to fetch conversations",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

/**
 * POST /api/conversations
 * Create a new conversation for the current user (if logged in) or session (if anonymous)
 */
export async function POST(req: NextRequest) {
  try {
    // Get authenticated user
    const session = await auth();
    const userId = session?.user?.id;
    
    const body = await req.json();
    const { sessionId, title, agentId } = body;

    // Must have either userId (logged in) or sessionId (anonymous)
    if (!userId && !sessionId) {
      return new Response(
        JSON.stringify({ error: "Authentication or session ID is required" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Create new conversation - use userId if logged in, otherwise sessionId
    // Include agentId if provided (null means basic LLM conversation)
    const conversationData: { userId?: string; sessionId?: string; title: string; agentId?: string | null } = {
      title: title || "New Conversation",
    };
    
    if (userId) {
      conversationData.userId = userId;
    } else if (sessionId) {
      conversationData.sessionId = sessionId;
    }
    
    // Set agentId (can be null for basic LLM, or a string for agent conversations)
    if (agentId !== undefined) {
      conversationData.agentId = agentId || null;
    }
    
    const conversation = await prisma.conversation.create({
      data: conversationData,
    });

    return Response.json({
      id: conversation.id,
      title: conversation.title,
      timestamp: conversation.createdAt,
      preview: "",
    });
  } catch (error) {
    console.error("Error creating conversation:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Failed to create conversation",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

